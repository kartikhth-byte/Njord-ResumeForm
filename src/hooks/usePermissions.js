/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function usePermissions(user) {
  const [permissions, setPermissions] = useState([])
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadPermissions()
    }
  }, [user])

  const loadPermissions = async () => {
    try {
      // Get user's permissions
      const { data: permData, error: permError } = await supabase
        .rpc('get_user_permissions', { user_uuid: user.id })

      if (permError) throw permError

      // Get user's role
      const { data: roleData, error: roleError } = await supabase
        .rpc('get_user_role', { user_uuid: user.id })

      if (roleError) throw roleError

      // Set role (get first role if multiple)
      setRole(roleData?.[0]?.role_name || null)
      
      // Set permissions (extract permission names)
      setPermissions(permData?.map(p => p.permission_name) || [])
      
    } catch (error) {
      console.error('Error loading permissions:', error)
      setPermissions([])
      setRole(null)
    } finally {
      setLoading(false)
    }
  }

  const hasPermission = (permissionName) => {
    return permissions.includes(permissionName)
  }

  // Helper functions matching database permission names
  const canManageTeam = () => hasPermission('manage_team')
  const canViewApplications = () => hasPermission('view_applications')
  const canManageApplications = () => hasPermission('manage_applications')
  const canExportData = () => hasPermission('export_data')
  const canViewAnalytics = () => hasPermission('view_analytics')
  const canDeleteApplications = () => hasPermission('delete_applications')
  const canManageSettings = () => hasPermission('manage_settings')
  const canViewTeam = () => hasPermission('view_team')

  return {
    permissions,
    role,
    loading,
    hasPermission,
    canManageTeam,
    canViewApplications,
    canManageApplications,
    canExportData,
    canViewAnalytics,
    canDeleteApplications,
    canManageSettings,
    canViewTeam
  }
}
