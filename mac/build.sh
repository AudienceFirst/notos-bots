#!/usr/bin/env bash
# Bouwt "NOTOS Bots.app" voor Apple Silicon, plus het zip-bestand en het manifest waarmee
# geïnstalleerde apps zichzelf bijwerken.
#
#   mac/build.sh                 bouwt de app in mac/build/
#   VERSION=3 SHORT=0.3 mac/build.sh --release https://notos.zuid.com/bots/mac
#
# Wat erin gaat:
#   - de Swift-schil (venster, menu, updater)
#   - de server en de migrator als losse binaries (bun build --compile), dus geen Bun op de Mac
#     van een collega
#   - de gebouwde frontend
#   - PostgreSQL: alleen de vijf programma's die we gebruiken, met hun bibliotheken meeverhuisd
#     zodat ze niet naar Homebrew wijzen
#
# De app wordt ad-hoc ondertekend. Dat is geen Apple-certificaat en haalt de waarschuwing bij de
# eerste keer openen niet weg; het is wat macOS op Apple Silicon minimaal eist om een programma
# überhaupt te willen draaien.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
BUILD="$HERE/build"
APP="$BUILD/NOTOS Bots.app"
RES="$APP/Contents/Resources"
PGSRC="${PGSRC:-/opt/homebrew/opt/postgresql@16}"

VERSION="${VERSION:-1}"
SHORT="${SHORT:-0.1}"
RELEASE_BASE=""
if [ "${1:-}" = "--release" ]; then RELEASE_BASE="${2:?geef het adres waar de zip komt te staan}"; fi

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

command -v swiftc >/dev/null || { echo "swiftc ontbreekt: installeer de Command Line Tools"; exit 1; }
command -v bun >/dev/null || { echo "bun ontbreekt"; exit 1; }
[ -x "$PGSRC/bin/postgres" ] || { echo "geen PostgreSQL in $PGSRC (brew install postgresql@16)"; exit 1; }

rm -rf "$BUILD"
mkdir -p "$RES/bin" "$RES/scripts" "$APP/Contents/MacOS"

step "De frontend bouwen"
(cd "$REPO/app" && bun run build >/dev/null)
cp -R "$REPO/app/dist" "$RES/app"

step "Server en migrator compileren"
(cd "$REPO/server" \
  && bun build --compile --target=bun-darwin-arm64 src/index.ts --outfile "$RES/bin/notos-bots-server" >/dev/null \
  && bun build --compile --target=bun-darwin-arm64 src/notos/migrate.ts --outfile "$RES/bin/notos-bots-migrate" >/dev/null)

step "Migraties en klantenlijst meenemen"
cp -R "$REPO/server/drizzle" "$RES/drizzle"
cp "$REPO/.local/clients.json" "$RES/clients.json"

step "PostgreSQL meenemen"
mkdir -p "$RES/postgres/bin" "$RES/postgres/lib" "$RES/postgres/share"
for tool in postgres initdb pg_ctl psql createdb; do
  cp "$PGSRC/bin/$tool" "$RES/postgres/bin/$tool"
done
cp -R "$PGSRC/share/postgresql@16" "$RES/postgres/share/postgresql@16"
cp -R "$PGSRC/lib/postgresql" "$RES/postgres/lib/postgresql"

# De programma's van Homebrew wijzen naar /opt/homebrew. Op een Mac zonder Homebrew bestaat dat
# pad niet, dus elke bibliotheek die ze nodig hebben gaat mee de bundel in en de verwijzing wordt
# omgeschreven naar de map ernaast.
python3 "$HERE/scripts/bundle-libs.py" "$RES/postgres"

step "De schil compileren"
swiftc -O -target arm64-apple-macos13.0 \
  -framework AppKit -framework WebKit -framework CryptoKit \
  -o "$APP/Contents/MacOS/NOTOS Bots" \
  "$HERE/Sources/main.swift"

cp "$HERE/scripts/local-server.sh" "$RES/scripts/local-server.sh"
chmod +x "$RES/scripts/local-server.sh"
cp "$HERE/Resources/NotosBots.icns" "$RES/NotosBots.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>NOTOS Bots</string>
  <key>CFBundleDisplayName</key><string>NOTOS Bots</string>
  <key>CFBundleIdentifier</key><string>com.zuid.notos-bots</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$SHORT</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>NOTOS Bots</string>
  <key>CFBundleIconFile</key><string>NotosBots</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>ZUID</string>
</dict>
</plist>
PLIST

step "Ad-hoc ondertekenen"
# Elk programma apart, van binnen naar buiten. `--deep` kijkt alleen op de plekken waar macOS
# code verwacht (Frameworks, PlugIns) en slaat alles in Resources over; en `install_name_tool`
# heeft de handtekening van elke verplaatste bibliotheek net stukgemaakt. Op Apple Silicon is een
# ongeldige handtekening geen waarschuwing maar een SIGKILL, dus dit is niet optioneel.
find "$RES" -type f \( -perm -u+x -o -name '*.dylib' -o -name '*.so' \) -print0 \
  | while IFS= read -r -d '' file; do
      case "$(file -b "$file")" in
        *Mach-O*) codesign --force --sign - --timestamp=none "$file" >/dev/null 2>&1 ;;
      esac
    done
codesign --force --sign - "$APP/Contents/MacOS/NOTOS Bots" >/dev/null 2>&1
codesign --force --sign - "$APP" 2>&1 | sed 's/^/  /'
codesign --verify "$APP" && echo "  handtekening klopt"
"$RES/postgres/bin/postgres" --version | sed 's/^/  /'

SIZE=$(du -sh "$APP" | cut -f1)
echo
echo "Klaar: $APP  ($SIZE, versie $SHORT build $VERSION)"

if [ -n "$RELEASE_BASE" ]; then
  step "Pakket en manifest maken"
  ZIP="$BUILD/NOTOS-Bots-$SHORT.zip"
  (cd "$BUILD" && /usr/bin/ditto -c -k --sequesterRsrc --keepParent "NOTOS Bots.app" "$ZIP")
  SHA=$(shasum -a 256 "$ZIP" | cut -d' ' -f1)
  cat > "$BUILD/appcast.json" <<JSON
{
  "version": $VERSION,
  "shortVersion": "$SHORT",
  "url": "${RELEASE_BASE%/}/$(basename "$ZIP")",
  "sha256": "$SHA",
  "notes": "",
  "mandatory": false
}
JSON
  echo "  $ZIP"
  echo "  $BUILD/appcast.json"
  echo
  echo "Zet allebei op ${RELEASE_BASE%/}/ en elke geïnstalleerde app werkt zichzelf bij."
fi
