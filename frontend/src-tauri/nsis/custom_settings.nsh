; ==========================================================
; ATRI Chat 自定义 NSIS 脚本
; 负责完善安装与卸载逻辑，特别是用户数据的清理。
; ==========================================================

; ----------------------------------------------------------
; 1. 语言字符串定义 (支持多语言弹窗)
; ----------------------------------------------------------

; 默认字符串 (英文)
LangString DESC_DeleteData ${LANG_ENGLISH} "Do you want to delete all user data (chat history, models, and settings)? This cannot be undone."
LangString TITLE_DeleteData ${LANG_ENGLISH} "Clean User Data"

; 简体中文
LangString DESC_DeleteData ${LANG_CHINESE} "是否要删除所有用户数据（聊天记录、模型文件和设置）？此操作不可撤销。"
LangString TITLE_DeleteData ${LANG_CHINESE} "清理用户数据"

; ----------------------------------------------------------
; 2. 卸载扩展逻辑 (customUninstStep)
; ----------------------------------------------------------
!macro NSIS_HOOK_POSTUNINSTALL
  ; 这里的逻辑会在卸载的最后阶段执行

  ; 1. 尝试结束正在运行的进程 (防止文件锁定导致删除失败)
  DetailPrint "正在停止 ATRI Chat 相关进程..."
  nsExec::Exec 'taskkill /F /IM "ATRI Chat.exe" /T'
  nsExec::Exec 'taskkill /F /IM "atri-backend-x86_64-pc-windows-msvc.exe" /T'
  Sleep 1000 ; 等待一秒让系统释放句柄
  
  ; 2. 弹出询问对话框
  MessageBox MB_YESNO|MB_ICONQUESTION "$(DESC_DeleteData)" IDNO done
  
  ; 3. 清理用户数据
  DetailPrint "正在清理用户数据目录..."
  
  ; 删除 AppData/Roaming 下的数据文件夹 (包含 data, db, logs 等)
  RMDir /r "$APPDATA\ATRI-Chat"

  DetailPrint "用户数据清理完成。"

done:
!macroend
