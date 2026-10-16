import styles from './login.module.css';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
};

/** Labelled input with a leading icon and an optional trailing control (login page only). */
export function LoginField({ id, label, icon, trailing, ...input }: Props) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.inputWrap}>
        <span className={styles.inputIcon} aria-hidden="true">{icon}</span>
        <input id={id} className={styles.input} {...input} />
        {trailing}
      </div>
    </div>
  );
}
