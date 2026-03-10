import { generatePdf } from 'html-pdf-node';
import { ProfileSnapshot, SessionRecord } from '../types';

export class PDFService {
  async generatePDF(session: SessionRecord, profile: ProfileSnapshot | null): Promise<Buffer> {
    const html = this.generateHTML(session, profile);
    return generatePdf(
      { content: html },
      {
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
        printBackground: true,
      }
    );
  }

  private generateHTML(session: SessionRecord, profile: ProfileSnapshot | null) {
    const fields = [
      ['年龄', profile?.age],
      ['家庭所在城市', profile?.hometown],
      ['现居城市', profile?.currentCity],
      ['性格特征', profile?.personality],
      ['期待的对象特征', profile?.expectations],
    ];

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>用户信息表</title>
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; padding: 40px; color: #333; }
    h1 { margin-bottom: 8px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
    .field { margin-bottom: 16px; padding: 14px; background: #f8f8f8; border-left: 4px solid #4CAF50; }
    .label { font-weight: bold; margin-bottom: 6px; }
    .empty { color: #999; font-style: italic; }
  </style>
</head>
<body>
  <h1>用户信息表</h1>
  <div class="meta">会话 ID: ${session.id}</div>
  ${fields
    .map(
      ([label, value]) => `<div class="field"><div class="label">${label}</div><div class="${value ? '' : 'empty'}">${value || '待了解'}</div></div>`
    )
    .join('')}
</body>
</html>`;
  }
}
