@echo off
chcp 65001 >nul
title 自然聊天信息提取器 - 启动程序
setlocal

echo.
echo ========================================
echo   自然聊天信息提取器
echo   Natural Chat Profiler
echo ========================================
echo.

:: 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [✓] Node.js 已安装
node --version
echo.

:: 检查 MySQL 是否运行（可选检查）
echo [检查] 正在检查 MySQL 服务...
sc query MySQL80 | find "RUNNING" >nul 2>nul
if %errorlevel% equ 0 (
    echo [✓] MySQL 服务正在运行
) else (
    echo [!] 警告: MySQL 服务可能未运行
    echo     如果数据库连接失败，请启动 MySQL 服务
)
echo.

:: 检查并安装后端依赖
echo ========================================
echo [1/2] 检查后端环境...
echo ========================================
echo.

pushd "%~dp0backend"
if not exist node_modules (
    echo [!] 检测到后端依赖未安装，正在安装...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 后端依赖安装失败
        popd
        pause
        exit /b 1
    )
)
popd

:: 检查并安装前端依赖
echo ========================================
echo [2/2] 检查前端环境...
echo ========================================
echo.

pushd "%~dp0frontend"
if not exist node_modules (
    echo [!] 检测到前端依赖未安装，正在安装...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 前端依赖安装失败
        popd
        pause
        exit /b 1
    )
)
popd

:: 启动后端（同一窗口，不额外打开 cmd）
echo ========================================
echo [启动] 启动后端服务器...
echo ========================================
echo.
start "backend" /b cmd /c "cd /d ""%~dp0backend"" && npm run dev"

echo [等待] 等待后端服务器启动 (5秒)...
timeout /t 5 /nobreak >nul

:: 延迟打开浏览器
start "browser" /b cmd /c "timeout /t 8 /nobreak >nul && start http://localhost:5173"

echo.
echo ========================================
echo [完成] 应用启动成功！
echo ========================================
echo.
echo 后端地址: http://localhost:3001
echo 前端地址: http://localhost:5173
echo.
echo ========================================
echo 使用说明:
echo ========================================
echo 1. 点击"新建会话"开始对话
echo 2. 在左侧输入框输入消息
echo 3. 右侧会实时显示提取的信息
echo 4. 点击"导出 PDF"保存信息
echo.
echo [注意] 当前只保留这一个命令行窗口
echo        关闭此窗口即可同时停止前后端服务
echo.
echo ========================================
echo [前端] 正在启动前端开发服务器...
echo ========================================
echo.

pushd "%~dp0frontend"
call npm run dev
popd
