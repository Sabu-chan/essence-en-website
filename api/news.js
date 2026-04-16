// api/news.js
// Vercel Serverless Function — Notion API連携
//
// 【環境変数】Vercel ダッシュボード → Settings → Environment Variables に設定
//   NOTION_TOKEN   : Notionのインテグレーションシークレット（secret_xxxxx）
//   NOTION_DB_ID   : NotionデータベースのID（URLの末尾32文字）
//
// 【Notionデータベースのプロパティ名】
//   タイトル : "title"     (Title型)
//   日付     : "date"      (Date型)
//   本文     : "body"      (Rich Text型)
//   画像URL  : "image"     (URL型) ※任意
//   公開     : "published" (Checkbox型) ✅のみ表示

export default async function handler(req, res) {
  // CORS対応（必要に応じて）
  res.setHeader('Access-Control-Allow-Origin', '*');

  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.NOTION_DB_ID;

  if (!token || !dbId) {
    return res.status(500).json({ error: 'Notion credentials not configured.' });
  }

  try {
    const notionRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          property: 'published',
          checkbox: { equals: true },
        },
        sorts: [
          { property: 'date', direction: 'descending' },
        ],
        page_size: 10,
      }),
    });

    if (!notionRes.ok) {
      const err = await notionRes.json();
      console.error('Notion API error:', err);
      return res.status(502).json({ error: 'Notion API request failed.' });
    }

    const data = await notionRes.json();

    const posts = data.results.map(page => {
      // タイトル
      const titleProp = page.properties.title;
      const title = titleProp?.title?.[0]?.plain_text || '(タイトルなし)';

      // 日付
      const dateProp = page.properties.date;
      const rawDate = dateProp?.date?.start || '';
      const date = rawDate
        ? rawDate.replace(/-/g, '.').slice(0, 10)
        : '';

      // 本文
      const bodyProp = page.properties.body;
      const body = bodyProp?.rich_text?.map(t => t.plain_text).join('') || '';

      // 画像URL
      const imageProp = page.properties.image;
      const image = imageProp?.url || null;

      return { title, date, body, image };
    });

    // キャッシュ: 5分
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(posts);

  } catch (e) {
    console.error('Unexpected error:', e);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
