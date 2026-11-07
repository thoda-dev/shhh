declare module '#app' {
  interface PageMeta {
    /** Read by the `auth` middleware: the least role a page renders for. */
    role?: 'admin' | 'super_admin'
  }
}

export {}
