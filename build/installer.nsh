!macro customInstall
  ; Forca o icone correto no atalho da area de trabalho
  SetOutPath "$INSTDIR"
  CreateShortCut "$DESKTOP\Catalogu.lnk" "$INSTDIR\Catalogu.exe" "" "$INSTDIR\Catalogu.exe" 0
!macroend
