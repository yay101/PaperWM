import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/**
 * Workspace related utility functions used by other modules.
 * Global-only mode: all workspaces share a single settings object.
 */
const WORKSPACE_LIST_KEY = 'org.gnome.shell.extensions.paperwm.workspacelist';
const WORKSPACE_KEY = 'org.gnome.shell.extensions.paperwm.workspace';

const GLOBAL_UUID = '00000000-0000-0000-0000-000000000000';

export class WorkspaceSettings {
    constructor(extension) {
        this.schemaSource = Gio.SettingsSchemaSource.new_from_directory(
            GLib.build_filenamev([extension.path, "schemas"]),
            Gio.SettingsSchemaSource.get_default(),
            false
        );

        this.workspaceList = new Gio.Settings({
            settings_schema: this.getSchemaSource().lookup(WORKSPACE_LIST_KEY, true),
        });

        // Ensure only the global UUID is in the list
        this.workspaceList.set_strv('list', [GLOBAL_UUID]);

        this.globalSettings = new Gio.Settings({
            settings_schema: this.getSchemaSource().lookup(WORKSPACE_KEY, true),
            path: `/org/gnome/shell/extensions/paperwm/workspaces/${GLOBAL_UUID}/`,
        });
    }

    getSchemaSource() {
        return this.schemaSource;
    }

    getWorkspaceName(settings, index) {
        let name = settings.get_string('name') ?? `Workspace ${index + 1}`;
        if (!name || name === '') {
            name = `Workspace ${index + 1}`;
        }
        return name;
    }

    getWorkspaceList() {
        return this.workspaceList;
    }

    /**
     * Returns list of ordered workspace UUIDs (single global UUID).
     */
    getListUUID() {
        return [GLOBAL_UUID];
    }

    getWorkspaceSettings(_index) {
        return [GLOBAL_UUID, this.globalSettings];
    }

    getWorkspaceSettingsByUUID(_uuid) {
        return this.globalSettings;
    }

    // Debug helpers kept for compatibility
    findWorkspaceSettingsByName(_regex) {
        return [[GLOBAL_UUID, this.globalSettings, this.globalSettings.get_string('name')]];
    }

    deleteWorkspaceSettingsByName(_regex, _dryrun = true) {}
    deleteWorkspaceSettings(_uuid) {}

    printWorkspaceSettings() {
        console.log('index:', this.globalSettings.get_int('index'),
            this.globalSettings.get_string('name'),
            this.globalSettings.get_string('color'), GLOBAL_UUID);
    }
}
