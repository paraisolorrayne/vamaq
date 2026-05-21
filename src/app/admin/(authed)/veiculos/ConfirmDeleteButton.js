'use client';

import { useTransition } from 'react';
import { deleteVehicleAction } from './actions';
import styles from '../../admin.module.css';

export default function ConfirmDeleteButton({ vehicleId, label }) {
  const [pending, startTransition] = useTransition();

  const handleClick = (e) => {
    e.preventDefault();
    const confirmed = window.confirm(
      `Excluir definitivamente "${label}"? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;
    const fd = new FormData();
    fd.set('id', vehicleId);
    startTransition(async () => {
      await deleteVehicleAction(fd);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`${styles.rowAction} ${styles.rowActionDanger}`}
    >
      {pending ? 'Excluindo…' : 'Excluir'}
    </button>
  );
}
