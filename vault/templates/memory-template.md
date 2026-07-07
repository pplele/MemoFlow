---
id: "{{id}}"
title: "{{title}}"
created_at: "{{created_at}}"
updated_at: "{{updated_at}}"
source: "{{source}}"
type: "{{type}}"
category: "{{category}}"
tags: {{tags}}
entities: {{entities}}
relations: {{relations}}
confidence: {{confidence}}
---

# {{title}}

## 正文

{{content}}

## AI 解析摘要

{{summary}}

## 元数据

| 属性 | 值 |
|------|------|
| ID | `{{id}}` |
| 来源 | {{source}} |
| 类型 | {{type}} |
| 分类 | {{category}} |
| 创建时间 | {{created_at}} |
| 更新时间 | {{updated_at}} |
| 置信度 | {{confidence}}% |

## 标签

{{tags_display}}

## 实体

{{entities_display}}

## 关联记忆

{{links}}

## 附件

{{attachments}}

## 提取的事实

{{facts_display}}
