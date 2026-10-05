/*
 * Nexora Installer
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

using System.Diagnostics;
using System.Reflection;

const string ProductName = "Nexora";
const string ModDirectoryName = "Nexora";
const string EmbeddedAsarName = "Nexora.desktop.asar";

var channels = new[] {
    new DiscordChannel("Stable", "Discord"),
    new DiscordChannel("PTB", "DiscordPTB"),
    new DiscordChannel("Canary", "DiscordCanary")
};

try {
    Console.Title = $"{ProductName} Installer";
    Console.WriteLine($"{ProductName} Installer");
    Console.WriteLine("This installs Nexora into an existing Discord desktop installation.\n");

    if (!OperatingSystem.IsWindows())
        throw new InvalidOperationException("The Nexora installer is only supported on Windows.");

    var selectedChannel = SelectChannel(channels, args);
    var resourcesPath = FindNewestResourcesDirectory(selectedChannel);
    var appAsar = Path.Combine(resourcesPath, "app.asar");
    var backupAsar = Path.Combine(resourcesPath, "_app.asar");
    var appDirectory = Path.Combine(resourcesPath, "app");
    var stubIndex = Path.Combine(appDirectory, "index.js");

    if (IsDiscordRunning())
        throw new InvalidOperationException("Discord is currently running. Fully close Discord and run this installer again.");

    var modDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        ModDirectoryName
    );
    var modAsar = Path.Combine(modDirectory, "desktop.asar");

    var alreadyPatched = File.Exists(backupAsar);
    if (alreadyPatched && !IsNexoraStub(stubIndex, modAsar))
        throw new InvalidOperationException(
            "This Discord installation is already patched by a different client mod. " +
            "Uninstall that mod before installing Nexora."
        );

    Directory.CreateDirectory(modDirectory);
    WriteEmbeddedAsar(modAsar);

    if (!alreadyPatched) {
        if (!File.Exists(appAsar))
            throw new InvalidOperationException("Discord's app.asar was not found. Reinstall Discord, then try again.");

        PatchDiscord(resourcesPath, appAsar, backupAsar, appDirectory, stubIndex, modAsar);
        Console.WriteLine($"\nInstalled {ProductName} into Discord {selectedChannel.DisplayName}.");
    } else {
        Console.WriteLine($"\nUpdated {ProductName}'s package for Discord {selectedChannel.DisplayName}.");
    }

    Console.WriteLine($"Nexora's files are stored in: {modDirectory}");
    Console.WriteLine("Your original Discord app archive was saved as _app.asar.");
    Console.Write("\nStart Discord now? [Y/n] ");
    if (ReadYes())
        StartDiscord(selectedChannel);
}
catch (Exception exception) {
    Console.Error.WriteLine($"\nInstallation failed: {exception.Message}");
    Environment.ExitCode = 1;
}

static DiscordChannel SelectChannel(IEnumerable<DiscordChannel> channels, string[] args) {
    var requestedName = args.FirstOrDefault(arg => arg.StartsWith("--channel=", StringComparison.OrdinalIgnoreCase))?
        .Split('=', 2)[1];
    var installed = channels.Where(channel => Directory.Exists(channel.InstallDirectory)).ToArray();

    if (requestedName is not null) {
        var requested = channels.FirstOrDefault(channel => string.Equals(channel.Id, requestedName, StringComparison.OrdinalIgnoreCase));
        if (requested is null)
            throw new InvalidOperationException("Unknown channel. Use --channel=stable, --channel=ptb, or --channel=canary.");
        if (!Directory.Exists(requested.InstallDirectory))
            throw new InvalidOperationException($"Discord {requested.DisplayName} is not installed for this Windows account.");
        return requested;
    }

    if (installed.Length == 0)
        throw new InvalidOperationException("Discord Stable, PTB, or Canary was not found in Local AppData.");
    if (installed.Length == 1)
        return installed[0];

    Console.WriteLine("Choose a Discord installation:");
    for (var i = 0; i < installed.Length; i++)
        Console.WriteLine($"  {i + 1}. {installed[i].DisplayName}");
    Console.Write("Selection: ");
    return int.TryParse(Console.ReadLine(), out var selection) && selection >= 1 && selection <= installed.Length
        ? installed[selection - 1]
        : throw new InvalidOperationException("No valid Discord installation was selected.");
}

static string FindNewestResourcesDirectory(DiscordChannel channel) {
    var appDirectories = Directory.EnumerateDirectories(channel.InstallDirectory, "app-*")
        .OrderByDescending(path => VersionKey(Path.GetFileName(path)))
        .ToArray();

    foreach (var directory in appDirectories) {
        var resources = Path.Combine(directory, "resources");
        if (Directory.Exists(resources))
            return resources;
    }

    throw new InvalidOperationException($"No usable Discord {channel.DisplayName} installation was found.");
}

static Version VersionKey(string directoryName) =>
    Version.TryParse(directoryName[4..], out var version) ? version : new Version();

static void WriteEmbeddedAsar(string targetPath) {
    var temporaryPath = targetPath + ".new";
    using var source = Assembly.GetExecutingAssembly().GetManifestResourceStream(EmbeddedAsarName)
        ?? throw new InvalidOperationException("The Nexora desktop package is missing from this installer.");
    using (var target = File.Create(temporaryPath))
        source.CopyTo(target);
    File.Move(temporaryPath, targetPath, true);
}

static bool IsNexoraStub(string stubIndex, string modAsar) {
    if (!File.Exists(stubIndex)) return false;
    return File.ReadAllText(stubIndex).Contains(modAsar, StringComparison.OrdinalIgnoreCase);
}

static void PatchDiscord(string resources, string appAsar, string backupAsar, string appDirectory, string stubIndex, string modAsar) {
    var movedOriginal = false;
    try {
        File.Move(appAsar, backupAsar);
        movedOriginal = true;
        Directory.CreateDirectory(appDirectory);
        File.WriteAllText(Path.Combine(appDirectory, "package.json"), "{\"name\":\"nexora\",\"main\":\"index.js\"}");
        File.WriteAllText(stubIndex, $"require({System.Text.Json.JsonSerializer.Serialize(modAsar)});");
    }
    catch {
        if (Directory.Exists(appDirectory))
            Directory.Delete(appDirectory, true);
        if (movedOriginal && File.Exists(backupAsar) && !File.Exists(appAsar))
            File.Move(backupAsar, appAsar);
        throw;
    }
}

static bool IsDiscordRunning() => Process.GetProcesses()
    .Any(process => process.ProcessName.Equals("Discord", StringComparison.OrdinalIgnoreCase));

static bool ReadYes() {
    var answer = Console.ReadLine();
    return string.IsNullOrWhiteSpace(answer) || answer.Equals("y", StringComparison.OrdinalIgnoreCase) || answer.Equals("yes", StringComparison.OrdinalIgnoreCase);
}

static void StartDiscord(DiscordChannel channel) {
    var updateExe = Path.Combine(channel.InstallDirectory, "Update.exe");
    if (!File.Exists(updateExe)) {
        Console.WriteLine("Could not find Discord's launcher. Start Discord normally instead.");
        return;
    }
    Process.Start(new ProcessStartInfo(updateExe, "--processStart Discord.exe") { UseShellExecute = true });
}

sealed record DiscordChannel(string Id, string DirectoryName) {
    public string DisplayName => Id == "Stable" ? "Stable" : Id;
    public string InstallDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        DirectoryName
    );
}
