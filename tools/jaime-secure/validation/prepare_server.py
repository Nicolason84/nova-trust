from pathlib import Path
import json
import os
import secrets
import yaml

root = Path('/tmp/jaime-e2ee-test')
os.umask(0o077)
cfg_path = root / 'homeserver.yaml'
cfg = yaml.safe_load(cfg_path.read_text())
cfg.update({
    'pid_file': str(root / 'synapse.pid'),
    'public_baseurl': 'http://127.0.0.1:18765/',
    'listeners': [{
        'port': 18765,
        'tls': False,
        'type': 'http',
        'x_forwarded': False,
        'bind_addresses': ['127.0.0.1'],
        'resources': [{'names': ['client'], 'compress': False}],
    }],
    'federation_domain_whitelist': [],
    'trusted_key_servers': [],
    'suppress_key_server_warning': True,
    'allow_profile_lookup_over_federation': False,
    'allow_public_rooms_over_federation': False,
    'report_stats': False,
    'enable_metrics': False,
    'enable_registration': False,
    'enable_registration_without_verification': False,
    'url_preview_enabled': False,
    'rc_message': {'per_second': 100, 'burst_count': 200},
    'rc_registration': {'per_second': 100, 'burst_count': 100},
    'rc_login': {kind: {'per_second': 100, 'burst_count': 200} for kind in ['address', 'account', 'failed_attempts']},
    'rc_joins': {'local': {'per_second': 100, 'burst_count': 200}, 'remote': {'per_second': 0.01, 'burst_count': 1}},
})
cfg_path.write_text(yaml.safe_dump(cfg, sort_keys=False))
cfg_path.chmod(0o600)
credentials = {
    'baseUrl': 'http://127.0.0.1:18765',
    'serverName': 'jaime-test.local',
    'users': [
        {'username': 'synthetic_alice', 'password': secrets.token_urlsafe(32)},
        {'username': 'synthetic_bob', 'password': secrets.token_urlsafe(32)},
    ],
}
credentials_path = root / 'credentials.json'
credentials_path.write_text(json.dumps(credentials, indent=2))
credentials_path.chmod(0o600)
print('Local-only config prepared; credentials saved privately, mode 0600.')
