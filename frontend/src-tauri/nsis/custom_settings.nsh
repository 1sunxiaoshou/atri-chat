; ==========================================================
; ATRI Chat 自定义 NSIS 脚本
; 仅保留必要的轻量扩展：
; - 卸载前尽量停止相关进程
; - 卸载前询问是否删除用户数据
; - 卸载后按用户确认清理数据目录
; ==========================================================

Var DeleteUserData

; 英文
LangString DESC_DeleteData ${LANG_ENGLISH} "Do you also want to delete local user data (chat history, downloaded models, and settings)? This cannot be undone."
LangString TITLE_DeleteData ${LANG_ENGLISH} "Remove Local Data"
LangString DETAIL_StopProcesses ${LANG_ENGLISH} "Stopping ATRI Chat processes..."
LangString DETAIL_DeleteData ${LANG_ENGLISH} "Removing local user data..."
LangString DETAIL_DeleteDataDone ${LANG_ENGLISH} "Local user data removed."

; 简体中文
LangString DESC_DeleteData ${LANG_CHINESE} "是否同时删除本机用户数据（聊天记录、已下载模型和设置）？此操作不可撤销。"
LangString TITLE_DeleteData ${LANG_CHINESE} "删除本机数据"
LangString DETAIL_StopProcesses ${LANG_CHINESE} "正在停止 ATRI Chat 相关进程..."
LangString DETAIL_DeleteData ${LANG_CHINESE} "正在删除本机用户数据..."
LangString DETAIL_DeleteDataDone ${LANG_CHINESE} "本机用户数据删除完成。"

!macro NSIS_HOOK_PREUNINSTALL
  StrCpy $DeleteUserData "0"

  DetailPrint "$(DETAIL_StopProcesses)"
  nsExec::Exec 'taskkill /F /IM "ATRI Chat.exe" /T'
  nsExec::Exec 'taskkill /F /IM "atri-backend-x86_64-pc-windows-msvc.exe" /T'
  Sleep 1000

  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "$(DESC_DeleteData)" /SD IDNO IDYES choose_delete
  Goto done

choose_delete:
  StrCpy $DeleteUserData "1"

done:
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  StrCmp $DeleteUserData "1" 0 done
  IfFileExists "$LOCALAPPDATA\ATRI-Chat\*.*" 0 done

  DetailPrint "$(DETAIL_DeleteData)"
  RMDir /r "$LOCALAPPDATA\ATRI-Chat"
  DetailPrint "$(DETAIL_DeleteDataDone)"

done:
!macroend
