from pathlib import Path
import hashlib, hmac, json, os, secrets
import requests, yaml

root = Path('/tmp/jaime-e2ee-test')
os.umask(0o077)
cfg = yaml.safe_load((root / 'homeserver.yaml').read_text())
suffix = secrets.token_hex(4)
credentials = {'baseUrl': 'http://127.0.0.1:18765', 'users': []}
session = requests.Session()
session.trust_env = False
for name in ['facade_alice', 'facade_bob']:
    user = {'username': name + '_' + suffix, 'password': secrets.token_urlsafe(32)}
    nonce_reply = session.get(credentials['baseUrl'] + '/_synapse/admin/v1/register', timeout=10)
    nonce_reply.raise_for_status()
    nonce = nonce_reply.json()['nonce']
    parts = [nonce, user['username'], user['password'], 'notadmin']
    mac = hmac.new(cfg['registration_shared_secret'].encode(), b'\x00'.join(p.encode() for p in parts), hashlib.sha1).hexdigest()
    result = session.post(credentials['baseUrl'] + '/_synapse/admin/v1/register', json={
        'nonce': nonce, 'username': user['username'], 'password': user['password'],
        'admin': False, 'mac': mac, 'inhibit_login': True,
    }, timeout=15)
    if result.status_code != 200:
        raise RuntimeError(f'Local synthetic registration failed: HTTP {result.status_code}')
    user['userId'] = result.json()['user_id']
    assert 'access_token' not in result.json()
    credentials['users'].append(user)
target = root / 'facade-credentials.json'
target.write_text(json.dumps(credentials, indent=2))
target.chmod(0o600)
print('Two fresh local facade-test accounts registered; private credential file updated.')
