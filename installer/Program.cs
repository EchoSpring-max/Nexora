/*
 * Nexora Installer
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

using System.Diagnostics;
using System.Reflection;
using System.Windows.Forms;

const string ProductName = "Nexora";
const string ModDirectoryName = "Nexora";
const string EmbeddedAsarName = "Nexora.desktop.asar";

var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
var channels = new[] {
    new DiscordChannel("Stable", Path.Combine(localAppData, "Discord")),
    new DiscordChannel("PTB", Path.Combine(localAppData, "DiscordPTB")),
    new DiscordChannel("Canary", Path.Combine(localAppData, "DiscordCanary"))
};

try {
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
        ShowInfo($"Installed {ProductName} into Discord {selectedChannel.DisplayName}.\n\n" +
            $"Nexora's files are stored in:\n{modDirectory}\n\n" +
            "Discord's original app archive was saved as _app.asar.");
    } else {
        ShowInfo($"Updated {ProductName}'s package for Discord {selectedChannel.DisplayName}.\n\n" +
            $"Nexora's files are stored in:\n{modDirectory}");
    }

    if (AskToStartDiscord())
        StartDiscord(selectedChannel);
}
catch (Exception exception) {
    MessageBox.Show(
        $"{exception.Message}\n\nNo changes were made if installation did not complete.",
        $"{ProductName} Installer",
        MessageBoxButtons.OK,
        MessageBoxIcon.Error
    );
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
        return SelectCustomDiscordDirectory();
    if (installed.Length == 1)
        return installed[0];

    return SelectInstalledChannel(installed);
}

static DiscordChannel SelectCustomDiscordDirectory() {
    var result = MessageBox.Show(
        "Discord was not found in its usual Local AppData folder. Select your Discord installation folder (the folder that contains app-* folders).",
        $"{ProductName} Installer",
        MessageBoxButtons.OKCancel,
        MessageBoxIcon.Information
    );
    if (result != DialogResult.OK)
        throw new InvalidOperationException("Discord installation was not selected.");

    using var picker = new FolderBrowserDialog {
        Description = "Select the Discord installation folder containing app-* folders",
        UseDescriptionForTitle = true
    };
    if (picker.ShowDialog() != DialogResult.OK)
        throw new InvalidOperationException("Discord installation was not selected.");
    if (!Directory.EnumerateDirectories(picker.SelectedPath, "app-*").Any())
        throw new InvalidOperationException("That folder does not contain a Discord app-* installation folder.");

    return new DiscordChannel("Custom", picker.SelectedPath);
}

static DiscordChannel SelectInstalledChannel(DiscordChannel[] installed) {
    using var dialog = new Form {
        Text = $"{ProductName} Installer",
        StartPosition = FormStartPosition.CenterScreen,
        FormBorderStyle = FormBorderStyle.FixedDialog,
        MaximizeBox = false,
        MinimizeBox = false,
        ClientSize = new System.Drawing.Size(380, 185)
    };
    var label = new Label {
        Text = "Choose the Discord installation to patch:",
        AutoSize = true,
        Left = 16,
        Top = 18
    };
    var list = new ListBox {
        Left = 16,
        Top = 45,
        Width = 348,
        Height = 75,
        DataSource = installed,
        DisplayMember = nameof(DiscordChannel.DisplayName),
        SelectedIndex = 0
    };
    var cancel = new Button { Text = "Cancel", DialogResult = DialogResult.Cancel, Left = 205, Top = 137, Width = 75 };
    var select = new Button { Text = "Select", DialogResult = DialogResult.OK, Left = 289, Top = 137, Width = 75 };
    dialog.Controls.AddRange([label, list, cancel, select]);
    dialog.CancelButton = cancel;
    dialog.AcceptButton = select;

    return dialog.ShowDialog() == DialogResult.OK && list.SelectedItem is DiscordChannel selected
        ? selected
        : throw new InvalidOperationException("Discord installation was not selected.");
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

static void ShowInfo(string message) =>
    MessageBox.Show(message, $"{ProductName} Installer", MessageBoxButtons.OK, MessageBoxIcon.Information);

static bool AskToStartDiscord() =>
    MessageBox.Show(
        "Start Discord now?",
        $"{ProductName} Installer",
        MessageBoxButtons.YesNo,
        MessageBoxIcon.Question
    ) == DialogResult.Yes;

static void StartDiscord(DiscordChannel channel) {
    var updateExe = Path.Combine(channel.InstallDirectory, "Update.exe");
    if (!File.Exists(updateExe)) {
        Console.WriteLine("Could not find Discord's launcher. Start Discord normally instead.");
        return;
    }
    Process.Start(new ProcessStartInfo(updateExe, "--processStart Discord.exe") { UseShellExecute = true });
}

sealed record DiscordChannel(string Id, string InstallDirectory) {
    public string DisplayName => Id == "Stable" ? "Stable" : Id;
}
