#!/usr/bin/env bash

cd ~/Desktop/NOVA_VX

echo "=== FIX INDEX ==="

mkdir -p app

cat > app/index.html <<EOF
<!DOCTYPE html>
<html>
<head>
<title>NOVA TRUST</title>
</head>
<body>
<h1>🚀 NOVA TRUST ONLINE</h1>
<a href="/trust">GO TRUST</a>
</body>
</html>
EOF

git add .
git commit -m "fix index"
git push

echo "DONE"
