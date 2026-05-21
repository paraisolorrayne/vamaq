import Link from 'next/link';
import VehicleForm from '../VehicleForm';
import styles from '../../../admin.module.css';

export default function NovoVeiculoPage() {
  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Novo veículo</h1>
          <p className={styles.pageSubtitle}>
            Crie o cadastro com status <strong>Rascunho</strong>. Imagens e preview liberam após salvar.
          </p>
        </div>
        <Link href="/admin/veiculos" className={styles.btnOutline}>← Voltar</Link>
      </div>
      <VehicleForm />
    </>
  );
}
