import { ToolDefinition } from './tools.js';

function truncate(str: string, maxLen = 3000): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...（已截断）';
}

const externalTools: ToolDefinition[] = [
  {
    name: 'get_current_time',
    description: '获取当前日期和时间，支持时区转换。当用户询问时间、日期、日程安排时调用此工具',
    parameters: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: '时区，如 Asia/Shanghai、UTC、America/New_York，默认本地时区' },
        format: { type: 'string', description: '输出格式：full(完整)、date(仅日期)、time(仅时间)、timestamp(时间戳)' },
      },
      required: [],
    },
    execute: async (args) => {
      const timezone = args.timezone ? String(args.timezone) : Intl.DateTimeFormat().resolvedOptions().timeZone;
      const format = args.format ? String(args.format) : 'full';

      const now = new Date();

      const formatters: Record<string, () => string> = {
        full: () => {
          return now.toLocaleString('zh-CN', {
            timeZone: timezone,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        },
        date: () => {
          return now.toLocaleDateString('zh-CN', {
            timeZone: timezone,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          });
        },
        time: () => {
          return now.toLocaleTimeString('zh-CN', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        },
        timestamp: () => {
          return JSON.stringify({
            timestamp: now.getTime(),
            iso: now.toISOString(),
            timezone,
          });
        },
      };

      const formatter = formatters[format] || formatters.full;
      return JSON.stringify({
        timezone,
        format,
        result: formatter(),
        timestamp: now.getTime(),
      });
    },
  },

  {
    name: 'calculator',
    description: '数学计算器，支持基本运算和复杂表达式。当用户需要精确计算时调用此工具，避免直接回答导致计算错误',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: '数学表达式，如 "2+3*4"、"sin(30)"、"sqrt(16)"、"(5000-4500)/4500*100"' },
      },
      required: ['expression'],
    },
    execute: async (args) => {
      const expression = String(args.expression).trim();

      if (!expression) {
        return JSON.stringify({ error: '表达式不能为空' });
      }

      const unsafeChars = /[`;'"\\|]/g;
      if (unsafeChars.test(expression)) {
        return JSON.stringify({ error: '表达式包含非法字符' });
      }

      const mathExpression = expression
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/√/g, 'Math.sqrt')
        .replace(/π/g, 'Math.PI')
        .replace(/e/g, 'Math.E');

      const safeExpression = mathExpression.replace(
        /([a-zA-Z_]\w*)/g,
        (match) => {
          const allowed = ['Math', 'sin', 'cos', 'tan', 'sqrt', 'abs', 'log', 'ln', 'exp', 'pow', 'floor', 'ceil', 'round', 'PI', 'E'];
          return allowed.includes(match) ? match : `__${match}__`;
        }
      );

      try {
        const result = new Function(`return ${safeExpression}`)();
        
        if (typeof result !== 'number' || !isFinite(result)) {
          return JSON.stringify({ error: '计算结果无效' });
        }

        return JSON.stringify({
          expression,
          result: parseFloat(result.toPrecision(10)),
        });
      } catch (err: any) {
        return JSON.stringify({ error: `计算失败: ${err.message}` });
      }
    },
  },

  {
    name: 'web_search',
    description: '使用 DuckDuckGo 搜索引擎搜索网页信息（免费，无需 API Key）。当用户询问实时信息、新闻、知识查询时调用',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        num_results: { type: 'number', description: '返回结果数量，默认5，最多10' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const query = String(args.query).trim();
      const numResults = Math.min(Number(args.num_results) || 5, 10);

      if (!query) {
        return JSON.stringify({ error: '搜索关键词不能为空' });
      }

      try {
        const url = new URL('https://api.duckduckgo.com/');
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        url.searchParams.set('no_html', '1');
        url.searchParams.set('skip_disambig', '1');

        const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
        const data = (await response.json()) as Record<string, unknown>;

        const results: string[] = [];
        let count = 0;

        const abstract = (data.AbstractText as string) || '';
        if (abstract) {
          const source = (data.AbstractURL as string) || '';
          results.push(`[知识图谱] ${abstract}`);
          if (source) {
            results[results.length - 1] += `\n来源: ${source}`;
          }
          count++;
        }

        const relatedTopics = data.RelatedTopics as Array<Record<string, unknown>> || [];
        for (const topic of relatedTopics) {
          if (count >= numResults) break;
          const text = (topic.Text as string) || '';
          const topicUrl = (topic.FirstURL as string) || '';
          if (text) {
            results.push(`${count + 1}. ${text}`);
            if (topicUrl) {
              results[results.length - 1] += `\n${topicUrl}`;
            }
            count++;
          }
        }

        if (results.length === 0) {
          return JSON.stringify({ message: `未找到与 "${query}" 相关的结果` });
        }

        return truncate(results.join('\n\n'));
      } catch (err: any) {
        return JSON.stringify({ error: `搜索失败: ${err.message}` });
      }
    },
  },

  {
    name: 'web_fetch',
    description: '抓取网页内容并提取正文文本。当需要获取某个网页的详细内容时调用',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '网页地址，必须以 http:// 或 https:// 开头' },
        max_chars: { type: 'number', description: '最大返回字符数，默认3000，最多10000' },
      },
      required: ['url'],
    },
    execute: async (args) => {
      const url = String(args.url).trim();
      const maxChars = Math.min(Number(args.max_chars) || 3000, 10000);

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return JSON.stringify({ error: 'URL 必须以 http:// 或 https:// 开头' });
      }

      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(20000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (!response.ok) {
          return JSON.stringify({ error: `HTTP 错误: ${response.status} - ${url}` });
        }

        const html = await response.text();

        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].replace(/[\n\t]/g, '').trim() : '无标题';

        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/\s+/g, '\n')
          .split('\n')
          .filter((line) => line.trim())
          .join('\n');

        const truncated = text.length > maxChars
          ? text.slice(0, maxChars) + `\n\n...（截断：全文共 ${text.length} 字符）`
          : text;

        return truncate(`标题: ${title}\nURL: ${url}\n\n${truncated}`);
      } catch (err: any) {
        return JSON.stringify({ error: `抓取失败: ${err.message} - ${url}` });
      }
    },
  },

  {
    name: 'get_weather',
    description: '获取指定城市的天气信息。需要在 .env 中配置 OPENWEATHER_API_KEY',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: '城市名称，如 北京、Shanghai、Tokyo' },
        units: { type: 'string', description: '温度单位：metric(摄氏度，默认)、imperial(华氏度)' },
      },
      required: ['city'],
    },
    execute: async (args) => {
      const city = String(args.city).trim();
      const units = args.units ? String(args.units) : 'metric';
      const apiKey = process.env.OPENWEATHER_API_KEY;

      if (!apiKey) {
        return JSON.stringify({ error: '未配置 OpenWeather API Key，请在 .env 中设置 OPENWEATHER_API_KEY' });
      }

      if (!city) {
        return JSON.stringify({ error: '城市名称不能为空' });
      }

      try {
        const url = new URL('https://api.openweathermap.org/data/2.5/weather');
        url.searchParams.set('q', city);
        url.searchParams.set('appid', apiKey);
        url.searchParams.set('units', units);
        url.searchParams.set('lang', 'zh_cn');

        const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
        const data = (await response.json()) as Record<string, unknown>;

        const cod = data.cod as number;
        if (cod !== 200) {
          const message = (data.message as string) || '获取天气失败';
          return JSON.stringify({ error: message });
        }

        const tempUnit = units === 'metric' ? '°C' : '°F';
        const main = data.main as Record<string, unknown>;
        const sys = data.sys as Record<string, unknown>;
        const weatherArr = data.weather as Array<Record<string, unknown>> || [];
        const wind = data.wind as Record<string, unknown> || {};

        return JSON.stringify({
          city: data.name as string,
          country: sys.country as string,
          temperature: {
            current: main.temp as number,
            feels_like: main.feels_like as number,
            min: main.temp_min as number,
            max: main.temp_max as number,
            unit: tempUnit,
          },
          weather: {
            description: weatherArr[0]?.description as string || '',
            icon: weatherArr[0]?.icon as string || '',
          },
          humidity: main.humidity as number,
          wind: {
            speed: wind.speed as number || 0,
            direction: wind.deg as number || 0,
          },
          visibility: data.visibility as number,
          sunrise: new Date((sys.sunrise as number || 0) * 1000).toLocaleTimeString('zh-CN'),
          sunset: new Date((sys.sunset as number || 0) * 1000).toLocaleTimeString('zh-CN'),
        });
      } catch (err: any) {
        return JSON.stringify({ error: `获取天气失败: ${err.message}` });
      }
    },
  },
];

export function getExternalTools(): ToolDefinition[] {
  return externalTools;
}