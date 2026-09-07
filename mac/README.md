# NOTOS Bots voor macOS

Een echte Mac-app om NOTOS Bots heen: eigen venster, eigen Dock-icoon, en een updatekanaal
waarmee één nieuwe build bij iedereen terechtkomt.

## Twee standen

De app kan op twee manieren draaien; het menu **Weergave** wisselt ertussen.

**Lokaal op deze Mac** (de standaard). Alles draait op de Mac zelf: een meegeleverde PostgreSQL,
de Bots-server als los programma, en de interface daarnaast. Geen internet nodig, geen inloggen,
en niemand anders kan erbij.

> Wat dit kost: de database is van die ene Mac. Workspaces, campagnes, kanalen en goedkeuringen
> worden dus **niet** gedeeld met het team. Wat iemand hier opzet, ziet niemand anders. Dat is de
> stand voor uitproberen en offline doorwerken, niet voor werk waar een collega op wacht.

**Gedeeld.** De app toont `notos.zuid.com/bots`: dezelfde NOTOS als iedereen, één database, en wat
er gedeployed wordt heeft iedereen meteen. Hiervoor log je in met je ZUID-account.

> Nog niet vastgesteld: of het inlogscherm van Google werkt binnen het venster van de app. Google
> weigert OAuth in ingebouwde webvensters, en de schil zet wel een Safari-kenmerk maar dat is geen
> garantie. Dit moet één keer met een echt ZUID-account geprobeerd worden. Werkt het niet, dan is
> de oplossing `ASWebAuthenticationSession` plus een terugkoppeling van NOTOS naar de app.

## Bouwen

```bash
mac/build.sh
```

Levert `mac/build/NOTOS Bots.app`, ongeveer 200 MB. Nodig op de bouwmachine: `swiftc` (Command
Line Tools), `bun`, en `postgresql@16` via Homebrew (alleen om uit te kopiëren; de app heeft
Homebrew daarna niet meer nodig).

Wat erin gaat:

| Onderdeel | Waar het vandaan komt |
| --- | --- |
| De schil (venster, menu, updater) | `mac/Sources/main.swift`, gecompileerd met `swiftc` |
| De server | `bun build --compile` van `server/src/index.ts` |
| De migrator | `bun build --compile` van `server/src/notos/migrate.ts` |
| De interface | `app/dist` |
| PostgreSQL 16 | vijf programma's uit Homebrew, met hun bibliotheken meeverhuisd |

De app wordt **ad-hoc ondertekend**. Dat is geen Apple Developer-certificaat: het is wat macOS op
Apple Silicon minimaal eist om een programma te willen draaien. De waarschuwing bij de eerste keer
openen blijft (zie Installeren).

## Uitbrengen

```bash
VERSION=2 SHORT=0.2 mac/build.sh --release https://<adres waar de bestanden komen>
```

Dat maakt er twee bestanden bij:

- `NOTOS-Bots-0.2.zip` — de app
- `appcast.json` — versienummer, adres van de zip, en de SHA-256 daarvan

Zet allebei op dat adres. Elke geïnstalleerde app kijkt bij het starten in `appcast.json`, en gaat
alleen over de zip heen als de hash klopt. `"mandatory": true` in het manifest slaat de vraag over
en werkt meteen bij; dat is de knop om iets bij iedereen recht te zetten.

`VERSION` is een oplopend geheel getal en bepaalt of er bijgewerkt wordt. `SHORT` is wat een mens
ziet.

**Waar de bestanden komen te staan is nog niet besloten.** De bucket `gs://notos-bots-mac`
(project `mge-zuid`, europe-west4) staat klaar maar is bewust niet openbaar: de zip bevat de hele
interne app inclusief de klantenlijst, en dat hoort niet op een adres dat iedereen kan opvragen.
Twee wegen, allebei werkbaar:

1. De bucket openbaar maken en de klantenlijst uit het pakket laten. Simpel, maar de lokale stand
   toont dan geen echte klant-workspaces.
2. De bestanden achter Cloudflare zetten, op `notos.zuid.com/bots/mac/`, waar de rest ook staat.
   Meer werk, maar de app blijft binnen ZUID en het adres verandert nooit meer.

Zolang dat niet staat, controleert de app tevergeefs op updates: dat wordt gelogd en verder gebeurt
er niets.

## Installeren (voor een collega)

1. Zip openen en `NOTOS Bots.app` naar Programma's slepen.
2. **De eerste keer:** rechtermuisknop op de app, dan **Open**, dan nog eens **Open**. Dubbelklikken
   werkt de eerste keer niet, want de app is niet notarised bij Apple. Daarna gewoon dubbelklikken.
3. Bij de eerste start legt de app de twee standen uit en zet hij zijn database klaar. Dat duurt
   ongeveer een halve minuut; daarna is starten een kwestie van tellen.

Wil je dat die eerste stap verdwijnt, dan is er een Apple Developer Program-account nodig
(99 euro per jaar) om te ondertekenen en te notariseren.

## Waar de app zijn spullen bewaart

`~/Library/Application Support/NOTOS Bots/`

| Bestand | Wat het is |
| --- | --- |
| `pgdata/` | de database van deze Mac |
| `key` | de sleutel waarmee opgeslagen API-sleutels versleuteld zijn |
| `pgpass`, `pgport` | wachtwoord en poort van de lokale PostgreSQL |
| `settings.json` | stand, adres van de gedeelde NOTOS, updateadres |
| `logs/` | `app.log` (de schil en de server) en `postgres.log` |

Dit staat buiten de app, dus een update raakt er niets van. Alles weghalen en opnieuw beginnen is
deze map weggooien.

## Dingen die onderweg bleken

- **`codesign --deep` doet niet wat de naam belooft.** Het ondertekent alleen de plekken waar macOS
  code verwacht (Frameworks, PlugIns) en slaat alles in `Resources` over. En omdat
  `install_name_tool` de handtekening van elke verplaatste bibliotheek stukmaakt, moet elk
  programma apart ondertekend worden, van binnen naar buiten. Op Apple Silicon is een ongeldige
  handtekening geen waarschuwing maar een SIGKILL, dus zonder dit start er niets.
- **Bun's SQL-client kan geen unix-socket in een verbindings-URL.** Alle drie de schrijfwijzen
  (`%2F`-gecodeerde host, `?socket=`, `?host=`) mislukken. Vandaar dat de meegeleverde PostgreSQL
  op de loopback luistert, op een vrije poort tussen 5440 en 5480, met een wachtwoord dat per
  installatie verschilt.
- **De migraties zitten niet in de binary.** `import.meta.dir` wijst in een gecompileerd programma
  naar een pad binnenín dat programma, dus `MIGRATIONS_DIR` wijst naar de map die meereist. Zonder
  die variabele startte de server tegen een lege database en viel hij pas om op de eerste query;
  daarom weigert de migrator nu te draaien als hij zijn map niet vindt.
- **De app draaide zichzelf niet, en dat zag je niet.** De standaardpoort was 3011, dezelfde als de
  ontwikkeldienst op deze Mac. Die antwoordde op de gezondheidscheck, dus de app dacht dat hij
  klaar was en toonde doodleuk een andere server dan zijn eigen. Nu 3021, en het startscript
  weigert te beginnen als die poort al bezet is.
- **Postgres start niet zonder taalinstelling.** Een app die door macOS gestart wordt erft geen
  `LANG`, en dan meldt Postgres "postmaster became multithreaded during startup" en stopt. In een
  terminal gebeurt dat niet, dus dit kwam pas boven bij het draaien vanuit Programma's.
- **Twee fouten in het venster.** `fullSizeContentView` liet de inhoud onder de rode, gele en
  groene knoppen doorlopen, en de statusregel lag als een onzichtbare balk over het midden waar hij
  het scrollen afving. Nu een gewone titelbalk, constraints in plaats van frames, en een
  statusregel die verborgen begint en nooit een muis onderschept.
- **pgvector zat in de weg.** Migratie 0000 maakte de extensie aan, 0010 gooit hem weer weg, en de
  meegeleverde PostgreSQL heeft hem niet. 0000 maakt hem nu alleen aan als hij er is. Dat is veilig
  voor bestaande databases: drizzle beslist op de tijdstempel uit het journal, niet op de inhoud,
  dus een migratie die al gedraaid is draait niet opnieuw.
