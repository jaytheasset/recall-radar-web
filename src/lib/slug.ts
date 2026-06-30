export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function brandToSlug(brand: string): string {
  return slugify(brand);
}

export function limitSlug(value: string, maxLength = 96): string {
  const slug = slugify(value);

  if (slug.length <= maxLength) {
    return slug;
  }

  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

export function recallSlug(title: string, id: string, maxBaseLength = 88): string {
  const idSlug = slugify(id);
  const base = limitSlug(title, maxBaseLength) || 'recall';
  return idSlug ? `${base}-${idSlug}` : base;
}

export function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
