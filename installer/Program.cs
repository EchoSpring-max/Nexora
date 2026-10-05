/*
 * Nexora Installer
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

using System.Diagnostics;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

const string ProductName = "Nexora";
const string ModDirectoryName = "Nexora";
const string EmbeddedAsarName = "Nexora.desktop.asar";
const string EmbeddedIconName = "Nexora.icon.png";

if (!OperatingSystem.IsWindows()) {
    MessageBox.Show("The Nexora installer is only supported on Windows.", "Nexora Installer", MessageBoxButtons.OK, MessageBoxIcon.Error);
    return;
}

ApplicationConfiguration.Initialize();
RunInstaller(DiscoverDiscordChannels(), args);

static string InstallNexora(DiscordChannel selectedChannel) {
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
        return $"Installed Nexora into Discord {selectedChannel.DisplayName}.\n\n" +
            "Your original Discord archive was safely saved as _app.asar.";
    } else {
        return $"Updated Nexora for Discord {selectedChannel.DisplayName}.\n\n" +
            "You're ready to launch Discord.";
    }
}

static void RunInstaller(DiscordChannel[] detectedChannels, string[] args) {
    var background = Color.FromArgb(18, 16, 27);
    var surface = Color.FromArgb(31, 28, 43);
    var surfaceAlt = Color.FromArgb(42, 37, 57);
    var accent = Color.FromArgb(184, 117, 255);
    var text = Color.FromArgb(244, 241, 251);
    var muted = Color.FromArgb(176, 168, 192);

    using var form = new Form {
        Text = "Nexora Setup",
        StartPosition = FormStartPosition.CenterScreen,
        ClientSize = new Size(680, 500),
        MinimumSize = new Size(680, 500),
        MaximizeBox = false,
        BackColor = background,
        ForeColor = text,
        Font = new Font("Segoe UI", 10F),
        FormBorderStyle = FormBorderStyle.FixedSingle
    };

    var header = new Panel { Dock = DockStyle.Top, Height = 172, BackColor = surface };
    header.Paint += (_, e) => {
        using var glow = new SolidBrush(Color.FromArgb(70, accent));
        e.Graphics.FillEllipse(glow, 445, -175, 360, 360);
        using var iconStream = Assembly.GetExecutingAssembly().GetManifestResourceStream(EmbeddedIconName);
        using var icon = iconStream is null ? null : Image.FromStream(iconStream);
        if (icon is not null)
            e.Graphics.DrawImage(icon, new Rectangle(32, 36, 62, 62));
    };
    var title = new Label { Text = "Welcome to Nexora", AutoSize = true, Location = new Point(117, 40), Font = new Font("Segoe UI", 23F, FontStyle.Bold), ForeColor = text };
    var subtitle = new Label { Text = "A cleaner way to personalize your Discord desktop client.", AutoSize = true, Location = new Point(120, 81), Font = new Font("Segoe UI", 10.5F), ForeColor = muted };
    var version = new Label { Text = "NEXORA SETUP  •  WINDOWS", AutoSize = true, Location = new Point(34, 127), Font = new Font("Segoe UI", 8F, FontStyle.Bold), ForeColor = Color.FromArgb(210, 186, 245) };
    header.Controls.AddRange([title, subtitle, version]);

    var content = new Panel { Dock = DockStyle.Fill, Padding = new Padding(34, 27, 34, 22), BackColor = background };
    var label = new Label { Text = "Discord installation", AutoSize = true, Location = new Point(34, 24), Font = new Font("Segoe UI", 11F, FontStyle.Bold), ForeColor = text };
    var help = new Label { Text = "Nexora detected your Discord installation automatically. Choose another one if needed.", AutoSize = true, Location = new Point(34, 50), ForeColor = muted };
    var channelPicker = new ComboBox { Location = new Point(34, 82), Width = 474, Height = 40, DropDownStyle = ComboBoxStyle.DropDownList, BackColor = surfaceAlt, ForeColor = text, FlatStyle = FlatStyle.Flat };
    channelPicker.Items.AddRange(detectedChannels);
    channelPicker.DisplayMember = nameof(DiscordChannel.DisplayName);
    if (detectedChannels.Length > 0) channelPicker.SelectedIndex = 0;

    var browse = new Button { Text = "Browse", Location = new Point(520, 81), Size = new Size(126, 42), FlatStyle = FlatStyle.Flat, BackColor = surfaceAlt, ForeColor = text, Cursor = Cursors.Hand };
    browse.FlatAppearance.BorderColor = Color.FromArgb(85, 77, 104);
    browse.Click += (_, _) => {
        try {
            var selected = SelectDiscordExecutable();
            channelPicker.Items.Add(selected);
            channelPicker.SelectedItem = selected;
        } catch (InvalidOperationException) { }
    };

    var notice = new Panel { Location = new Point(34, 143), Size = new Size(612, 54), BackColor = Color.FromArgb(33, 29, 47) };
    var noticeIcon = new Label { Text = "i", TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Segoe UI", 9F, FontStyle.Bold), ForeColor = Color.FromArgb(216, 185, 255), Location = new Point(14, 16), Size = new Size(20, 20), BackColor = Color.FromArgb(83, 61, 112) };
    var noticeText = new Label { Text = "Close Discord before installing. Your original app archive is backed up automatically.", Location = new Point(48, 17), AutoSize = true, ForeColor = Color.FromArgb(205, 197, 219) };
    notice.Controls.AddRange([noticeIcon, noticeText]);

    var launch = new CheckBox { Text = "Launch Discord after setup", AutoSize = true, Checked = true, Location = new Point(34, 216), ForeColor = muted, FlatStyle = FlatStyle.Flat };
    var status = new Label { Text = detectedChannels.Length > 0 ? "Ready to install" : "Select Discord.exe to continue", AutoSize = true, Location = new Point(34, 257), ForeColor = muted, Font = new Font("Segoe UI", 9F) };
    var install = new Button { Text = "Install Nexora", Location = new Point(481, 231), Size = new Size(165, 47), FlatStyle = FlatStyle.Flat, BackColor = accent, ForeColor = Color.FromArgb(29, 18, 40), Font = new Font("Segoe UI", 10F, FontStyle.Bold), Cursor = Cursors.Hand };
    install.FlatAppearance.BorderSize = 0;
    install.Click += async (_, _) => {
        if (channelPicker.SelectedItem is not DiscordChannel selected) {
            status.Text = "Choose a Discord installation first.";
            status.ForeColor = Color.FromArgb(255, 150, 163);
            return;
        }

        install.Enabled = false;
        browse.Enabled = false;
        channelPicker.Enabled = false;
        status.Text = "Installing Nexora…";
        status.ForeColor = Color.FromArgb(218, 190, 255);
        try {
            var result = await Task.Run(() => InstallNexora(selected));
            status.Text = "Setup complete";
            status.ForeColor = Color.FromArgb(106, 222, 177);
            install.Text = "Installed ✓";
            MessageBox.Show(result, "Nexora is ready", MessageBoxButtons.OK, MessageBoxIcon.Information);
            if (launch.Checked) StartDiscord(selected);
        } catch (Exception exception) {
            status.Text = exception.Message;
            status.ForeColor = Color.FromArgb(255, 150, 163);
            install.Enabled = true;
            browse.Enabled = true;
            channelPicker.Enabled = true;
        }
    };

    content.Controls.AddRange([label, help, channelPicker, browse, notice, launch, status, install]);
    form.Controls.AddRange([content, header]);
    Application.Run(form);
}

static DiscordChannel[] DiscoverDiscordChannels() {
    var channels = new List<DiscordChannel>();
    var seenDirectories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
    var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
    var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);

    AddDiscordDirectory(channels, seenDirectories, "Stable", Path.Combine(localAppData, "Discord"));
    AddDiscordDirectory(channels, seenDirectories, "PTB", Path.Combine(localAppData, "DiscordPTB"));
    AddDiscordDirectory(channels, seenDirectories, "Canary", Path.Combine(localAppData, "DiscordCanary"));
    AddDiscordDirectory(channels, seenDirectories, "Stable", Path.Combine(programFiles, "Discord"));
    AddDiscordDirectory(channels, seenDirectories, "Stable", Path.Combine(programFilesX86, "Discord"));

    foreach (var executable in FindDiscordExecutablesInRegistry()) {
        var directory = FindDiscordInstallDirectory(executable);
        if (directory is not null)
            AddDiscordDirectory(channels, seenDirectories, "Detected Discord", directory);
    }

    foreach (var process in Process.GetProcessesByName("Discord")) {
        try {
            var directory = FindDiscordInstallDirectory(process.MainModule?.FileName);
            if (directory is not null)
                AddDiscordDirectory(channels, seenDirectories, "Running Discord", directory);
        } catch {
            // Some processes do not expose their executable path to this process.
        } finally {
            process.Dispose();
        }
    }

    return channels.ToArray();
}

static void AddDiscordDirectory(List<DiscordChannel> channels, HashSet<string> seenDirectories, string id, string directory) {
    if (!Directory.Exists(directory) || !Directory.EnumerateDirectories(directory, "app-*").Any()) return;
    var fullPath = Path.GetFullPath(directory);
    if (seenDirectories.Add(fullPath))
        channels.Add(new DiscordChannel(id, fullPath));
}

static IEnumerable<string> FindDiscordExecutablesInRegistry() {
    const string uninstallPath = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
    var executables = new List<string>();
    foreach (var hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine }) {
        foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 }) {
            RegistryKey? uninstall = null;
            try {
                uninstall = RegistryKey.OpenBaseKey(hive, view).OpenSubKey(uninstallPath);
                if (uninstall is null) continue;
                foreach (var name in uninstall.GetSubKeyNames()) {
                    using var entry = uninstall.OpenSubKey(name);
                    if (entry is null) continue;
                    var displayName = entry.GetValue("DisplayName") as string;
                    if (displayName is null || !displayName.Contains("Discord", StringComparison.OrdinalIgnoreCase)) continue;

                    var installLocation = entry.GetValue("InstallLocation") as string;
                    if (!string.IsNullOrWhiteSpace(installLocation)) {
                        var candidate = Path.Combine(installLocation, "Discord.exe");
                        if (File.Exists(candidate)) executables.Add(candidate);
                    }

                    var displayIcon = entry.GetValue("DisplayIcon") as string;
                    if (!string.IsNullOrWhiteSpace(displayIcon)) {
                        var candidate = displayIcon.Trim().Trim('"').Split(',')[0];
                        if (File.Exists(candidate)) executables.Add(candidate);
                    }
                }
            } catch {
                // Registry probing is best-effort; standard locations remain available.
            } finally {
                uninstall?.Dispose();
            }
        }
    }
    return executables;
}

static string? FindDiscordInstallDirectory(string? executablePath) {
    if (string.IsNullOrWhiteSpace(executablePath) || !File.Exists(executablePath)) return null;
    var directory = new DirectoryInfo(Path.GetDirectoryName(executablePath)!);
    for (var i = 0; i < 3 && directory is not null; i++, directory = directory.Parent) {
        try {
            if (directory.EnumerateDirectories("app-*").Any())
                return directory.FullName;
        } catch {
            return null;
        }
    }
    return null;
}

static DiscordChannel SelectDiscordExecutable() {
    var result = MessageBox.Show(
        "Discord was not found automatically. Select Discord.exe to continue.",
        $"{ProductName} Installer",
        MessageBoxButtons.OKCancel,
        MessageBoxIcon.Information
    );
    if (result != DialogResult.OK)
        throw new InvalidOperationException("Discord installation was not selected.");

    using var picker = new OpenFileDialog {
        Title = "Select Discord.exe",
        Filter = "Discord executable (Discord.exe)|Discord.exe|Executable files (*.exe)|*.exe",
        CheckFileExists = true,
        Multiselect = false
    };
    if (picker.ShowDialog() != DialogResult.OK)
        throw new InvalidOperationException("Discord installation was not selected.");
    var directory = FindDiscordInstallDirectory(picker.FileName);
    if (directory is null)
        throw new InvalidOperationException("That file is not inside a Discord app-* installation folder.");

    return new DiscordChannel("Custom", directory);
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

static void StartDiscord(DiscordChannel channel) {
    var updateExe = Path.Combine(channel.InstallDirectory, "Update.exe");
    if (!File.Exists(updateExe)) {
        ShowInfo("Could not find Discord's launcher. Start Discord normally instead.");
        return;
    }
    Process.Start(new ProcessStartInfo(updateExe, "--processStart Discord.exe") { UseShellExecute = true });
}

sealed record DiscordChannel(string Id, string InstallDirectory) {
    public string DisplayName => Id == "Stable" ? "Stable" : Id;
}
