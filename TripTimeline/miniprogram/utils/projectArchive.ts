import { request } from './request';
import api from './api';

export function normalizeProjectArchived(value: any): boolean {
  return Number(value) === 1;
}

export async function fetchProjectArchivedState(projectId: string): Promise<boolean> {
  if (!projectId) return false;
  const project = await request<any>({
    url: api.project.detail(projectId),
    method: 'GET',
    showLoading: false,
  });
  return normalizeProjectArchived(project?.is_archived);
}

export function guardArchivedWrite(isProjectArchived: boolean): boolean {
  if (!isProjectArchived) return true;
  wx.showToast({ title: '项目已归档，请先取消归档', icon: 'none' });
  return false;
}
