import { Link } from 'react-router-dom'

interface EmptyStateProps {
  title: string
  description: string
  ctaLabel?: string
  ctaTo?: string
}

export default function EmptyState({ title, description, ctaLabel, ctaTo }: EmptyStateProps): JSX.Element {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {ctaLabel && ctaTo && (
        <Link className="btn btn-primary" to={ctaTo}>
          {ctaLabel}
        </Link>
      )}
    </div>
  )
}
