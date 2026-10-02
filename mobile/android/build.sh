#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# Reuses native/build.sh from KRIMI_Lab_sources.zip, SHA ead675903a5cef10fe10230d9f90175a37d3b3638825f1c420d5adc491bf1cf6.
SDK="${ANDROID_HOME:?Existing Android SDK required}"
BT="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-35/android.jar"
mkdir -p build/classes build/dex build/gen build/test-classes build/test-dex
find src -name '*.java' -print > build/sources.txt
javac -encoding UTF-8 -source 8 -target 8 -cp "$JAR" -d build/classes @build/sources.txt
"$BT/aapt2" compile --dir res -o build/resources.zip
"$BT/aapt2" link -o build/base.apk -I "$JAR" --manifest AndroidManifest.xml --java build/gen -A assets build/resources.zip
find build/classes -name '*.class' -print > build/classes.txt
"$BT/d8" --min-api 26 --lib "$JAR" --output build/dex @build/classes.txt
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q -j ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
find testsrc -name '*.java' -print > build/test-sources.txt
javac -encoding UTF-8 -source 8 -target 8 -cp "$JAR:build/classes" -d build/test-classes @build/test-sources.txt
find build/test-classes -name '*.class' -print > build/test-classes.txt
"$BT/d8" --min-api 26 --lib "$JAR" --classpath build/classes --output build/test-dex @build/test-classes.txt
"$BT/aapt2" link -o build/test-base.apk -I "$JAR" --manifest TestManifest.xml
cp build/test-base.apk build/test-unsigned.apk
(cd build/test-dex && zip -q -j ../test-unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 build/test-unsigned.apk build/test-aligned.apk
