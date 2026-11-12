import React from 'react';
import { useNavigate } from 'react-router-dom';
import BestDrafts from '@/pages/BestDrafts';

export default function BestDraftsRoute({ champions, version }) {
  const navigate = useNavigate();
  return (
    <BestDrafts
      champions={champions}
      version={version}
      onClose={() => navigate(-1)}
    />
  );
}