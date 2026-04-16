export default async function handler(req, res) {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.NOTION_DB_ID;

  if (!token || !dbId) {
    return res.status(500).json({ error: 'Missing env vars', token: !!token, dbId: !!dbId });
  }

  try {
    const url = `https://api.notion.com/v1/databases/${dbId}/query`;
    const body = JSON.stringify({
      filter: { property: 'published', checkbox: { equals: true } },
      sorts: [{ property: 'date', direction: 'descending' }]
    });

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body
    });

    const text = await r.text();

    if (!r.ok) {
      return res.status(500).json({ error: 'Notion API error', status: r.status, body: text });
    }

    const data = JSON.parse(text);
    const posts = (data.results || []).map(p => {
      const props = p.properties;
      const title = props.title?.title?.[0]?.plain_text || props.Name?.title?.[0]?.plain_text || '';
      const date  = props.date?.date?.start || '';
      const body  = props.body?.rich_text?.[0]?.plain_text || '';
      const image = props.image?.url || props.image?.files?.[0]?.file?.url || props.image?.files?.[0]?.external?.url || null;
      return { title, date, body, image };
    });

    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json(posts);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}