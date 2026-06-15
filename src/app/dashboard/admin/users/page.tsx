'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { UserCog, Trash2, Edit } from 'lucide-react'

interface UserItem {
  username: string
  isAdmin: boolean
  accessibleMenus: string[]
}

const MENU_OPTIONS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/serving', label: 'Service Operation' },
  { href: '/dashboard/llm', label: 'Private LLM' },
  { href: '/dashboard/deployments', label: 'Deployment Timelines' },
  { href: '/dashboard/evaluation', label: 'Quality Gate' },
  { href: '/dashboard/scraping', label: 'Data Scraping' },
  { href: '/dashboard/infrastructure', label: 'Infrastructure' },
  { href: '/dashboard/storage', label: 'Storage' },
  { href: '/dashboard/jupyter', label: 'Jupyter' },
  { href: '/dashboard/registry', label: 'Registry' },
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    username: '',
    password: '',
    isAdmin: false,
    accessibleMenus: [] as string[]
  })

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to load users')
      setUsers(await res.json())
    } catch (e) {
      toast.error('유저 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleOpenDialog = (user?: UserItem) => {
    if (user) {
      setEditingUser(user.username)
      setForm({
        username: user.username,
        password: '',
        isAdmin: user.isAdmin,
        accessibleMenus: user.accessibleMenus || []
      })
    } else {
      setEditingUser(null)
      setForm({
        username: '',
        password: '',
        isAdmin: false,
        accessibleMenus: MENU_OPTIONS.map(m => m.href)
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.username) {
      return toast.error('아이디를 입력해주세요')
    }
    if (!editingUser && !form.password) {
      return toast.error('비밀번호를 입력해주세요')
    }

    try {
      const method = editingUser ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error || 'Failed to save user')
      }

      toast.success('저장되었습니다.')
      setIsDialogOpen(false)
      fetchUsers()
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error(e.message)
      } else {
        toast.error('알 수 없는 오류가 발생했습니다.')
      }
    }
  }

  const handleDelete = async (username: string) => {
    if (!confirm(`${username} 유저를 삭제하시겠습니까?`)) return
    
    try {
      const res = await fetch(`/api/admin/users?username=${username}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete user')
      toast.success('삭제되었습니다.')
      fetchUsers()
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error(e.message)
      } else {
        toast.error('알 수 없는 오류가 발생했습니다.')
      }
    }
  }

  const toggleMenu = (href: string) => {
    setForm(prev => {
      const exists = prev.accessibleMenus.includes(href)
      if (exists) {
        return { ...prev, accessibleMenus: prev.accessibleMenus.filter(m => m !== href) }
      } else {
        return { ...prev, accessibleMenus: [...prev.accessibleMenus, href] }
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          사용자 계정과 접근 가능한 메뉴 권한을 관리합니다.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <CardTitle>Registered Users</CardTitle>
            <CardDescription>시스템에 등록된 사용자 목록입니다.</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()} className="h-8">
            <UserCog className="mr-2 size-4" /> 신규 유저 등록
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">아이디</th>
                  <th className="px-4 py-3 font-medium">관리자 여부</th>
                  <th className="px-4 py-3 font-medium">허용된 메뉴 수</th>
                  <th className="px-4 py-3 font-medium text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">로딩 중...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">등록된 유저가 없습니다.</td></tr>
                ) : (
                  users.map(u => (
                    <tr key={u.username} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{u.username}</td>
                      <td className="px-4 py-3">
                        {u.isAdmin ? (
                          <Badge className="bg-primary/20 text-primary hover:bg-primary/30">Admin</Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.accessibleMenus?.length || 0} 개 메뉴
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleOpenDialog(u)}>
                          <Edit className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleDelete(u.username)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? '유저 수정' : '신규 유저 등록'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>아이디</Label>
              <Input 
                value={form.username} 
                onChange={e => setForm({...form, username: e.target.value})} 
                disabled={!!editingUser}
                placeholder="seungyeon2"
              />
            </div>
            <div className="space-y-2">
              <Label>비밀번호 {editingUser && '(변경할 경우에만 입력)'}</Label>
              <Input 
                type="password"
                value={form.password} 
                onChange={e => setForm({...form, password: e.target.value})} 
                placeholder="비밀번호"
              />
            </div>
            <div className="flex items-center space-x-2 py-2 border-y">
              <Checkbox 
                id="isAdmin" 
                checked={form.isAdmin} 
                onCheckedChange={c => setForm({...form, isAdmin: !!c})} 
              />
              <Label htmlFor="isAdmin" className="font-semibold text-primary">관리자 (Admin) 권한 부여</Label>
            </div>
            <div className="space-y-3">
              <Label>접근 허용 메뉴</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded bg-muted/20">
                {MENU_OPTIONS.map(menu => (
                  <div key={menu.href} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`menu-${menu.href}`}
                      checked={form.accessibleMenus.includes(menu.href)}
                      onCheckedChange={() => toggleMenu(menu.href)}
                    />
                    <Label htmlFor={`menu-${menu.href}`} className="text-xs font-normal cursor-pointer leading-tight">
                      {menu.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
