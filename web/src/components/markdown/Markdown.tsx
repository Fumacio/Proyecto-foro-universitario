import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Link } from 'react-router';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { ImageLightbox } from '../ImageLightbox';
import remarkMentions from './remarkMentions';

const components: Components = {
  a: ({ href, children, className, node: _node, ...props }) => {
    void _node;
    if (href && href.startsWith('/') && !href.startsWith('//')) {
      return (
        <Link to={href} className={className}>
          {children}
        </Link>
      );
    }
    if (href?.startsWith('#')) {
      return (
        <a href={href} className={className} {...props}>
          {children}
        </a>
      );
    }
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer nofollow" {...props}>
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => {
    if (typeof src !== 'string' || !src) return null;
    return (
      <ImageLightbox src={src} alt={alt} className="inline-block max-w-full">
        <img src={src} alt={alt ?? ''} loading="lazy" />
      </ImageLightbox>
    );
  },
  table: ({ children }) => (
    <div className="md-table">
      <table>{children}</table>
    </div>
  ),
  input: ({ type, checked }) =>
    type === 'checkbox' ? <input type="checkbox" checked={!!checked} readOnly disabled={false} tabIndex={-1} /> : null,
};

const remarkPlugins = [remarkGfm, remarkMentions];

export const Markdown = memo(function Markdown({
  children,
  className,
  size = 'md',
}: {
  children: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('md', size === 'sm' && 'md-sm', className)}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
});
