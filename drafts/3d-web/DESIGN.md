---
name: 共振桌原型
description: 木頭與黃銅場地上的共振實驗
colors:
  background: '#17100b'
  foreground: '#f3dfbb'
  muted: '#c1aa87'
  brass: '#d7ac60'
  cyan: '#87f2e8'
  rule: '#725735'
typography:
  body:
    fontFamily: 'Microsoft JhengHei, system-ui, sans-serif'
    fontSize: '14px'
    lineHeight: 1.65
spacing:
  compact: '14px'
  medium: '24px'
  wide: '38px'
---

# 共振桌視覺系統（原型範圍）

## Overview

使用者指定的木頭／黃銅微縮場景。立體場地為主體，頁面只有名稱、相變狀態及操作提示。此文件只描述 drafts 原型。

## Colors

暖深木色承接黃銅及米色文字；青色用於核心、共振與相變。3D 材質的顏色由物理燈光呈現，不把畫面採樣色等同材質色。

## Typography

正文為本機系統字型。狀態 20px，手機 17px；說明 13–14px。標題使用本機明體 36px／29px，是離線原型的暫用排版，未訂為正式品牌字型。

## Layout

最大寬度 1500px。桌面外距 24px 38px；650px 以下改為 18px 14px。場景畫面高度 min(70vh,780px)，窄畫面為 54vh；相機維持方向並調整距離以容納場地。

## Elevation & Depth

以真實 WebGL 幾何厚度、場地陰影與材質高光表達深度；頁面不使用卡片陰影。相變使用受控 bloom 與場內波紋，不以全螢幕閃白表達。

## Shapes

矩形木框、黃銅螺絲與分段圍邊；球體搭配可辨識身份牌。四角各用不同幾何籠，中央半球罩體有圓形底座。

## Components

可聚焦 Canvas 支援 pointer 和鍵盤；焦點框為黃銅色 2px。相變狀態同時以文字與青色網線表達。減少動態偏好停用裝飾自轉與光環脈動，保留實際球運動和規則訊號。

## Do's and Don'ts

保留球號、四角靶、核心及固定發射座的可見關係。相變網必須反映真正 active 狀態；不使用預錄相變冒充互動。美術簡化與手機可讀性限制見 VISUAL-AUDIT.md。
