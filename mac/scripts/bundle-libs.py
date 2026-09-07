import os, shutil, subprocess, sys

root = sys.argv[1]
libdir = os.path.join(root, "lib")
bindir = os.path.join(root, "bin")
HOMEBREW = ("/opt/homebrew/", "/usr/local/")


def deps(binary):
    out = subprocess.run(["otool", "-L", binary], capture_output=True, text=True).stdout
    return [line.split(" (")[0].strip() for line in out.splitlines()[1:] if line.strip()]


def resolve(dep, origin):
    """Waar de bibliotheek echt staat, gezien vanaf het bestand dat ernaar verwijst."""
    if dep.startswith("@loader_path/") or dep.startswith("@executable_path/"):
        return os.path.normpath(os.path.join(os.path.dirname(origin), dep.split("/", 1)[1]))
    if dep.startswith("@rpath/"):
        # Homebrew zet zijn bibliotheken naast elkaar; dat is hier de enige rpath die telt.
        return os.path.normpath(os.path.join(os.path.dirname(origin), os.path.basename(dep)))
    return dep


# Alles wat mee moet, ook verwijzingen via @loader_path: libicuuc vraagt zo om libicudata, en dat
# bestand bestaat op een Mac zonder Homebrew niet.
collected = {}


def collect(binary, origin):
    for dep in deps(binary):
        real = resolve(dep, origin)
        if not real.startswith(HOMEBREW):
            continue
        name = os.path.basename(real)
        if name in collected:
            continue
        source = os.path.realpath(real)
        if not os.path.exists(source):
            print("  ontbreekt: " + dep)
            continue
        target = os.path.join(libdir, name)
        shutil.copy2(source, target)
        os.chmod(target, 0o755)
        collected[name] = target
        collect(target, source)


binaries = [os.path.join(bindir, name) for name in sorted(os.listdir(bindir))]
for binary in binaries:
    collect(binary, binary)

# De verwijzingen omschrijven naar de map die meereist.
for binary in binaries:
    for dep in deps(binary):
        real = resolve(dep, binary)
        if real.startswith(HOMEBREW):
            subprocess.run(
                ["install_name_tool", "-change", dep,
                 "@loader_path/../lib/" + os.path.basename(real), binary],
                capture_output=True)

for name, path in collected.items():
    subprocess.run(["install_name_tool", "-id", "@loader_path/" + name, path],
                   capture_output=True)
    for dep in deps(path):
        base = os.path.basename(dep)
        if dep.startswith("@loader_path/") and base in collected:
            continue  # wijst al naar de buurman
        if dep.startswith(HOMEBREW) or (not dep.startswith("/") and base in collected):
            subprocess.run(
                ["install_name_tool", "-change", dep, "@loader_path/" + base, path],
                capture_output=True)

print("  " + str(len(collected)) + " bibliotheken meeverhuisd")
