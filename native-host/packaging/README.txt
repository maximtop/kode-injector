Kode Injector Native Host
=========================

This package contains one read-only native messaging host and its installer.
The same host serves Firefox, Google Chrome, and Microsoft Edge.

Run the installer application with "install" to install for the current user.
Run it with "uninstall" to remove the host and browser registrations.

For unpacked Chrome or Edge builds, copy dev-extension-ids.example.json to
dev-extension-ids.json, enter the IDs displayed by the browsers, and run the
installer's "development --ids <path>" flow. Review the printed origins, then
rerun with --confirm. Production installation never imports this local file.

The host can only read explicitly requested local regular files. It cannot
write files, execute programs, list directories, or access the network.
