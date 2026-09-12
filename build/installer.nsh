!macro customInstall
  DetailPrint "Setting up Python, Node.js & Dependencies with Administrator privileges..."
  ExecShellWait "runas" '"$INSTDIR\resources\app\install-prereqs.bat"'
!macroend


