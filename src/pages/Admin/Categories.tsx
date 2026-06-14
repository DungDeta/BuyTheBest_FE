import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Spin,
  Tooltip,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  FolderOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { privateDelete, privateGet, privatePost, privatePut } from '@/api/api'
import type { ErrorResponse } from '@/types/api'
import './admin.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryResponse {
  id: number
  parent_id: number | null
  name: string
  slug: string
  icon_url: string | null
  sort_order: number
  created_at: string
}

interface CategoryNode extends CategoryResponse {
  children: CategoryNode[]
}

interface CategoryFormValues {
  name: string
  slug: string
  parent_id: number | null
  icon_url: string
  sort_order: number
}

type FormMode = 'create' | 'edit'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  const map: Record<string, string> = {
    à: 'a', á: 'a', ả: 'a', ã: 'a', ạ: 'a',
    ă: 'a', ắ: 'a', ằ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a',
    â: 'a', ấ: 'a', ầ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a',
    è: 'e', é: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e',
    ê: 'e', ế: 'e', ề: 'e', ể: 'e', ễ: 'e', ệ: 'e',
    ì: 'i', í: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
    ò: 'o', ó: 'o', ỏ: 'o', õ: 'o', ọ: 'o',
    ô: 'o', ố: 'o', ồ: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
    ơ: 'o', ớ: 'o', ờ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
    ù: 'u', ú: 'u', ủ: 'u', ũ: 'u', ụ: 'u',
    ư: 'u', ứ: 'u', ừ: 'u', ử: 'u', ữ: 'u', ự: 'u',
    ỳ: 'y', ý: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
    đ: 'd',
  }
  return text
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
}

function buildTree(flat: CategoryResponse[]): CategoryNode[] {
  const map = new Map<number, CategoryNode>()
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }))

  const roots: CategoryNode[] = []
  flat.forEach((c) => {
    const node = map.get(c.id)!
    if (c.parent_id === null) {
      roots.push(node)
    } else {
      const parent = map.get(c.parent_id)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
  })

  function sortNodes(nodes: CategoryNode[]): CategoryNode[] {
    return nodes
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((n) => ({ ...n, children: sortNodes(n.children) }))
  }

  return sortNodes(roots)
}

// ─── CategoryTreeNode ─────────────────────────────────────────────────────────

interface CategoryTreeNodeProps {
  node: CategoryNode
  depth: number
  onEdit: (cat: CategoryResponse) => void
  onDelete: (id: number) => void
  deleting: number | null
}

function CategoryTreeNode({
  node,
  depth,
  onEdit,
  onDelete,
  deleting,
}: CategoryTreeNodeProps) {
  return (
    <div className="category-node-wrapper">
      <div
        className="category-node"
        style={{ paddingLeft: depth * 20 + 12 }}
      >
        <div className="category-node__icon">
          {node.icon_url ? (
            <img src={node.icon_url} alt="" className="category-node__img" />
          ) : (
            <FolderOutlined style={{ color: 'var(--muted)', fontSize: 14 }} />
          )}
        </div>
        <div className="category-node__info">
          <span className="category-node__name">{node.name}</span>
          <span className="category-node__slug">{node.slug}</span>
          <span className="category-node__order">#{node.sort_order}</span>
        </div>
        <div className="category-node__actions">
          <Tooltip title="Sửa">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(node)}
            />
          </Tooltip>
          <Popconfirm
            title="Xoá danh mục này?"
            description="Không thể hoàn tác. Danh mục có sản phẩm hoặc danh mục con sẽ không xoá được."
            onConfirm={() => onDelete(node.id)}
            okText="Xoá"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Xoá">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deleting === node.id}
              />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="category-node__children">
          {node.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              deleting={deleting}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Component() {
  const { message } = App.useApp()
  const [form] = Form.useForm<CategoryFormValues>()

  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const [mode, setMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<number | null>(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await privateGet<CategoryResponse[]>('/admin/categories')
      setCategories(res.data)
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Không tải được danh mục')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const tree = useMemo(() => buildTree(categories), [categories])

  function handleAddNew() {
    setMode('create')
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue({ sort_order: 0, parent_id: null, icon_url: '' })
  }

  function handleEdit(cat: CategoryResponse) {
    setMode('edit')
    setEditingId(cat.id)
    form.setFieldsValue({
      name: cat.name,
      slug: cat.slug,
      parent_id: cat.parent_id ?? null,
      icon_url: cat.icon_url ?? '',
      sort_order: cat.sort_order,
    })
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (mode === 'create') {
      form.setFieldValue('slug', slugify(e.target.value))
    }
  }

  async function handleSubmit(values: CategoryFormValues) {
    setSubmitting(true)
    try {
      const payload = {
        name: values.name,
        slug: values.slug,
        parent_id: values.parent_id ?? undefined,
        icon_url: values.icon_url || undefined,
        sort_order: values.sort_order ?? 0,
      }

      if (mode === 'create') {
        await privatePost('/admin/categories', payload)
        message.success('Đã thêm danh mục')
        form.resetFields()
        form.setFieldsValue({ sort_order: 0, parent_id: null, icon_url: '' })
      } else if (editingId !== null) {
        await privatePut(`/admin/categories/${editingId}`, payload)
        message.success('Đã cập nhật danh mục')
      }

      await fetchCategories()
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Lưu thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id)
    try {
      await privateDelete(`/admin/categories/${id}`)
      message.success('Đã xoá danh mục')
      if (editingId === id) {
        handleAddNew()
      }
      await fetchCategories()
    } catch (err) {
      const e = err as ErrorResponse
      message.error(e?.error ?? 'Xoá thất bại')
    } finally {
      setDeleting(null)
    }
  }

  const parentOptions = useMemo(
    () =>
      categories
        .filter((c) => c.id !== editingId)
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, editingId],
  )

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="admin-page__title">Danh mục</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddNew}
        >
          Thêm danh mục
        </Button>
      </div>

      <div className="categories-layout">
        {/* Left: Tree */}
        <div className="category-tree">
          {loading ? (
            <div className="category-tree__loading">
              <Spin />
            </div>
          ) : tree.length === 0 ? (
            <div className="category-tree__empty">Chưa có danh mục nào</div>
          ) : (
            tree.map((node) => (
              <CategoryTreeNode
                key={node.id}
                node={node}
                depth={0}
                onEdit={handleEdit}
                onDelete={handleDelete}
                deleting={deleting}
              />
            ))
          )}
        </div>

        {/* Right: Form */}
        <div className="category-form">
          <p className="category-form__title">
            {mode === 'create' ? 'Thêm danh mục mới' : 'Sửa danh mục'}
          </p>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ sort_order: 0, parent_id: null, icon_url: '' }}
          >
            <Form.Item
              label="Tên danh mục"
              name="name"
              rules={[{ required: true, message: 'Nhập tên danh mục' }]}
            >
              <Input
                placeholder="VD: Điện thoại"
                onChange={handleNameChange}
              />
            </Form.Item>

            <Form.Item
              label="Slug"
              name="slug"
              rules={[{ required: true, message: 'Nhập slug' }]}
            >
              <Input placeholder="VD: dien-thoai" />
            </Form.Item>

            <Form.Item label="Danh mục cha" name="parent_id">
              <Select
                allowClear
                placeholder="Không có (danh mục gốc)"
                options={parentOptions}
              />
            </Form.Item>

            <Form.Item label="Icon URL" name="icon_url">
              <Input placeholder="https://..." />
            </Form.Item>

            <Form.Item label="Thứ tự" name="sort_order">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <div className="category-form__actions">
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
              >
                {mode === 'create' ? 'Thêm' : 'Lưu thay đổi'}
              </Button>
              {mode === 'edit' && (
                <Button onClick={handleAddNew} disabled={submitting}>
                  Huỷ
                </Button>
              )}
            </div>
          </Form>
        </div>
      </div>
    </div>
  )
}
