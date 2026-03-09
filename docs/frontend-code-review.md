# 前端代码审查报告

**分支**: `ci/add-github-actions`
**首轮审查**: 2026-03-09
**复查确认**: 2026-03-09
**审查范围**: git 工作区变更文件

## 审查文件

| 文件 | 状态 |
|------|------|
| `apps/web/src/app/generate/page.tsx` | 已修改 |
| `apps/web/src/app/layout.tsx` | 已修改 |
| `apps/web/src/app/page.tsx` | 已修改 |
| `apps/web/src/app/run/[id]/page.tsx` | 已修改 |
| `apps/web/src/components/Navbar.tsx` | 新增 |
| `apps/web/src/components/PageHeader.tsx` | 新增 |

---

## 全量问题总览

| 轮次 | 优先级 | 问题 | 文件 | 状态 |
|------|--------|------|------|------|
| 第一轮 | 中 | 遗留调试注释（Fix 2/3/4） | `generate/page.tsx` | ✅ 已修复 |
| 第一轮 | 中 | 手写类型与 schema 脱节 | `generate/page.tsx` | ✅ 已修复 |
| 第一轮 | 中 | Badge 三目逻辑可读性 | `run/[id]/page.tsx` | ✅ 已修复 |
| 第一轮 | 中 | index 作为列表 key | `run/[id]/page.tsx` | ✅ 已修复 |
| 第一轮 | 低 | 重复计算搜索关键词 | `page.tsx` | ✅ 已修复 |
| 第一轮 | 低 | 导航缺少 active 状态 | `Navbar.tsx` | ✅ 已修复 |
| 第一轮 | 低 | 浏览按钮未 scrollIntoView | `page.tsx` | ✅ 已修复 |
| 第二轮 | 高 | 早返回代替 Suspense 边界 | `run/[id]/page.tsx` | ✅ 已修复 |
| 第二轮 | 中 | 未使用 `useSuspenseQuery` | `page.tsx`、`run/[id]/page.tsx` | ✅` 已修复 |
| 第二轮 | 低 | 事件处理函数缺少 `useCallback` | `page.tsx`、`generate/page.tsx`、`run/[id]/page.tsx` | 🚫 已退回 |
| 第二轮 | 低 | 错误通知方式不统一 | `generate/page.tsx`、`run/[id]/page.tsx` | 🚫 已退回 |
| 第三轮 | 低 | `ErrorBoundary` 缺少 `componentDidCatch` | `ErrorBoundary.tsx` | ✅ 已修复 |
| 第三轮 | 低 | 组件声明风格不一致（FC vs function） | `Navbar.tsx`、`PageHeader.tsx`、`run/[id]/page.tsx` | 🚫 已退回 |
| 第四轮 | 低 | 过滤逻辑未用 `useMemo` | `page.tsx` | 🚫 已退回 |
| 第四轮 | 低 | 空状态早返回 | `page.tsx` | 🚫 已退回 |

---

## 第一轮：已修复问题

### 1. 遗留调试注释 — `generate/page.tsx` ✅

`// Fix 2:`、`// Fix 3:`、`// Fix 4:` 等临时标注已全部清除。

### 2. 手写类型与 schema 脱节 — `generate/page.tsx` ✅

```tsx
// 修复前
async function handleGenerate(values: { description: string; model: string }) {

// 修复后（第 38 行）
async function handleGenerate(values: GenerateSkill) {
```

`GenerateSkill` 从 `@skill-plant/shared` 导入，类型单一来源，schema 变更时自动同步。

### 3. Badge 三目逻辑可读性 — `run/[id]/page.tsx` ✅

```tsx
// 修复前
{done && events.some(e => e.type === 'error')
  ? <Badge variant="destructive">Failed</Badge>
  : done && <Badge variant="default">Done</Badge>}

// 修复后（第 70-74 行）
{done && (
  events.some(e => e.type === 'error')
    ? <Badge variant="destructive">Failed</Badge>
    : <Badge variant="default">Done</Badge>
)}
```

### 4. 重复计算搜索关键词 — `page.tsx` ✅

```tsx
// 修复前
skills?.filter(s =>
  s.name.toLowerCase().includes(search.toLowerCase().trim()) ||
  s.description.toLowerCase().includes(search.toLowerCase().trim())
)

// 修复后（第 14-18 行）
const q = search.toLowerCase().trim()
skills?.filter(s =>
  s.name.toLowerCase().includes(q) ||
  s.description.toLowerCase().includes(q)
)
```

### 5. `/generate` 导航缺少 active 状态 — `Navbar.tsx` ✅

```tsx
// 修复前
<Button asChild size="sm">

// 修复后（第 28 行）
<Button asChild size="sm" variant={pathname === '/generate' ? 'default' : 'outline'}>
```

### 6. 浏览全部按钮未滚动到视口 — `page.tsx` ✅

```tsx
// 修复前
onClick={() => searchRef.current?.focus()}

// 修复后（第 33-36 行）
onClick={() => {
  searchRef.current?.focus()
  searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}}
```

---

## 第二轮：已修复问题

### 1. 早返回代替 Suspense 边界 — `run/[id]/page.tsx` ✅

```tsx
// 修复前：条件早返回
if (skillLoading || schemaLoading) {
  return <div className="container mx-auto py-8 px-4">Loading...</div>
}
if (!skill || !schema) {
  return <div className="container mx-auto py-8 px-4">Skill not found</div>
}

// 修复后：拆分外层（Suspense + ErrorBoundary）与内层（useSuspenseQuery）
export default function RunSkillPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <ErrorBoundary fallback={<div className="container mx-auto py-8 px-4">Skill not found</div>}>
      <Suspense fallback={<div className="container mx-auto py-8 px-4">Loading...</div>}>
        <RunSkillContent id={id} />
      </Suspense>
    </ErrorBoundary>
  )
}
```

### 2. 未使用 `useSuspenseQuery` — `page.tsx`、`run/[id]/page.tsx` ✅

```tsx
// 修复前：手动处理 isLoading / isError
const { data: skills, isLoading, isError } = useSkills()

// 修复后：useSuspenseQuery + ErrorBoundary 接管加载与错误状态
const { data: skills } = useSuspenseQuery({
  queryKey: ['skills'],
  queryFn: () => apiGet<Skill[]>('/skills'),
})
```

同步新增 `ErrorBoundary` 组件（`apps/web/src/components/ErrorBoundary.tsx`）保留"Is the API running?"错误提示，`page.test.tsx` 改为 mock `apiGet` + `QueryClientProvider` wrapper。

### 3. 事件处理函数缺少 `useCallback` — 多文件 🚫 已退回

**退回原因**：就本次 PR 的具体场景（事件处理函数传给子组件）而言，`DynamicForm`、`Button`（shadcn/ui）均未使用 `React.memo`，接收方不会因引用变化而跳过渲染，添加 `useCallback` 无实际性能收益。注意：`useCallback` 还有稳定 `useEffect` 依赖数组的用途，若后续出现此类场景需单独评估。

### 4. 错误通知方式不统一 — `generate/page.tsx`、`run/[id]/page.tsx` 🚫 已退回

**退回原因**：`sonner` 未在 `apps/web/package.json` 中，安装新包仅为替换功能正常的内联 `<p>` 错误提示，超出本导航/布局 PR 的范围。如需统一错误通知风格，建议作为独立 PR 处理。

---

## 第三轮：已修复问题

### 1. `ErrorBoundary` 缺少 `componentDidCatch` — `ErrorBoundary.tsx` ✅

```tsx
// 修复后
componentDidCatch(error: Error, info: ErrorInfo) {
  console.error('ErrorBoundary caught:', error, info.componentStack)
}
```

`componentDidCatch` 是接入 Sentry 等错误监控的必要挂载点，同时确保开发环境下错误信息可见。

---

## 第三轮：已退回问题

### 2. 组件声明风格不一致 — `Navbar.tsx`、`PageHeader.tsx`、`RunSkillContent` 🚫 已退回

**退回原因**：项目内无任何 `React.FC` 用例（grep 结果为空），现有组件（`SkillCard`、`DynamicForm`）全部使用 `export function` 声明。`React.FC` 在 React 18+ 已属过时模式（移除了隐式 `children` 类型注入，TypeScript 推断能力也未优于显式声明），Next.js 官方文档同样使用 function 声明。新增组件与项目一致，不存在风格不统一问题。

---

## 第四轮：已退回问题

### 1. 过滤逻辑未用 `useMemo` — `page.tsx` 🚫 已退回

**退回原因**：`SkillGrid` 仅在 `search` prop 变化时 re-render，而 `search` 变化恰好是 filter 必须重新计算的时机，`useMemo([skills, search])` 无法减少任何实际计算次数。`skills` 为小型列表，`O(n)` filter 耗时可忽略不计；`useMemo` 自身的依赖比较反而带来额外开销。审查方援引的"指南规定"在本项目任何配置文件中均不存在。

### 2. 空状态早返回 — `page.tsx` 🚫 已退回

**退回原因**：第 25 行早返回位于全部 hook（`useSuspenseQuery`）调用之后，符合 React 规则，不存在 hook 顺序问题。三目条件渲染在此场景下可读性并不优于早返回。审查方援引的"No Early Returns"规则在 CLAUDE.md 及项目任何文档中均无记录。
