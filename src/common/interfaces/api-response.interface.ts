export interface ListResponse<T> {
  meta: ListResponseMeta;
  data: Partial<T>[];
}

export interface ListResponseMeta {
  total: number;
  page: number;
  lastPage: number;
}
