import React from 'react';

interface SectionHeaderProps {
  id?: string;
  title: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ id, title }) => (
  <header className="ms-section-head" id={id}>
    <div className="ms-section-head__rules">
      <span className="ms-section-head__rule" aria-hidden />
      <h2 className="ms-section-head__label">{title}</h2>
      <span className="ms-section-head__rule" aria-hidden />
    </div>
  </header>
);
