"""Run against the isolated Meteor package-test app; requires Chromium/ChromeDriver."""
import argparse
import json
import shutil
import subprocess
import tempfile
import time
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://localhost:3970/')
parser.add_argument('--driver-port', type=int, default=9523)
args = parser.parse_args()
base = f'http://127.0.0.1:{args.driver_port}'


def call(path, data=None, method=None):
    request = urllib.request.Request(base + path,
        data=None if data is None else json.dumps(data).encode(),
        headers={'Content-Type': 'application/json'}, method=method)
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.load(response)['value']


def eventually(operation, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            value = operation()
            if value:
                return value
        except (OSError, KeyError):
            pass
        time.sleep(.2)
    raise RuntimeError('Timed out waiting for browser test')


session = None
with tempfile.TemporaryDirectory(prefix='iziam-browser-') as profile:
    process = subprocess.Popen(['chromedriver', f'--port={args.driver_port}'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        eventually(lambda: call('/status'))
        binary = shutil.which('chromium-browser') or shutil.which('chromium') or shutil.which('google-chrome')
        assert binary, 'Chromium is required'
        session = call('/session', {'capabilities': {'alwaysMatch': {
            'browserName': 'chrome', 'goog:loggingPrefs': {'browser': 'ALL'},
            'goog:chromeOptions': {'binary': binary, 'args': [
                '--headless', '--no-sandbox', '--disable-gpu', f'--user-data-dir={profile}']}
        }}})['sessionId']
        path = '/session/' + session
        call(path + '/timeouts', {'script': 30000})
        call(path + '/url', {'url': args.url})

        def js(script):
            return call(path + '/execute/sync', {'script': 'const Meteor = Package.meteor.Meteor;\n' + script, 'args': []})

        def async_js(script):
            return call(path + '/execute/async', {'script': 'const Meteor = Package.meteor.Meteor;\n' + script, 'args': []})

        eventually(lambda: js('return typeof Package !== "undefined" && !!Package["test-in-console"];'))
        js('Package["test-in-console"].runTests();')
        result = eventually(lambda: js('const s = Package["test-in-console"].TEST_STATUS; return s.DONE && s;'))
        print(json.dumps(result, indent=2))
        assert result['FAILURES'] == 0

        js('''window.iziamStateMessages = [];
            Meteor.connection._stream.on('message', raw => {
                const message = JSON.parse(raw);
                if (message.collection === 'iz_oauth_states') window.iziamStateMessages.push(message);
            });''')
        result = async_js('''const done = arguments[0];
            Meteor.callAsync('iziam.tests.setup').then(() => {
                Meteor.loginWithIzIAM({}, error => done({error: error?.message, userId: Meteor.userId()}));
            }).catch(error => done({error: error.message}));''')
        assert not result.get('error'), result
        user_id = result['userId']
        assert user_id, result
        assert js('return !/test-access|test-refresh/.test(JSON.stringify(Meteor.user()));')
        assert js('return window.iziamStateMessages.length === 0;')
        assert js("return Meteor.user()?.services?.iziam?.username === 'integration-test';")
        print('PASS popup login, public identity, and private state/credentials with autopublish')

        result = async_js('''const done = arguments[0];
            Package['pwix:accounts-iziam'].AccountsIziam.changePassword({},
                error => done({error: error?.message, userId: Meteor.userId()}));''')
        assert not result.get('error') and result['userId'] == user_id, result
        print('PASS password change retains the current identity')

        result = async_js('const done = arguments[0]; Meteor.logout(error => done(error?.message || null));')
        assert result is None, result
        js("Meteor.loginWithIzIAM({loginStyle: 'redirect'});")
        found = eventually(lambda: js('return typeof Meteor !== "undefined" && Meteor.userId();'))
        assert found == user_id, (found, user_id)
        print('PASS redirect login matches the existing user')

        js("Package['pwix:accounts-iziam'].AccountsIziam.logout().catch(error => { window.logoutError = error.message; });")
        eventually(lambda: js('return typeof Meteor !== "undefined" && Meteor.status().connected && !Meteor.userId();'))
        assert not js('return window.logoutError || null;')
        result = async_js('''const done = arguments[0];
            Meteor.callAsync('pwix.accountsIziam.changeOptions', {}).then(
                () => done('unexpected success'), error => done(error.error));''')
        assert result == 'not-authorized', result
        print('PASS logout and anonymous password-change rejection')
    except Exception as error:
        if hasattr(error, 'read'): print(error.read().decode())
        if session:
            for handle in call('/session/' + session + '/window/handles'):
                call('/session/' + session + '/window', {'handle': handle})
                print(call('/session/' + session + '/url'))
                print(call('/session/' + session + '/execute/sync', {'script': 'return document.body.innerText;', 'args': []}))
            print(json.dumps(call('/session/' + session + '/log', {'type': 'browser'}), indent=2))
        raise
    finally:
        if session:
            call('/session/' + session, method='DELETE')
        process.terminate()
        process.wait(timeout=10)
