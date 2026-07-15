Kode Injector Native Host
=========================

This package contains one read-only native messaging host and its installer.
The same host serves Firefox, Google Chrome, and Microsoft Edge.

Extract the complete archive and keep both executables together while running
the installer. Installation is per-user and does not require administrator or
root access.

Linux (from a terminal opened in the extracted directory):

    ./kode-injector-installer install
    ./kode-injector-installer uninstall

Windows PowerShell (from the extracted directory):

    .\kode-injector-installer.exe install
    .\kode-injector-installer.exe uninstall

The install command copies the host into the current user's application-data
directory and registers Firefox, Chrome, and Edge. The uninstall command removes
only Kode Injector's host copy and browser registrations.

For unpacked Chrome or Edge builds, create a development-ID JSON file as shown
in the repository's DEVELOPMENT.md, then run the installer's
"development --ids <path>" flow. Review the printed origins, then rerun with
--confirm. Production installation never imports this local file.

The host can only read explicitly requested local regular files. It cannot
write files, execute programs, list directories, or access the network.
