import { Children, Fragment, isValidElement, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { Select as Dropdown, type SelectOption } from './Dropdown';

export interface SelectProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'defaultValue' | 'onChange'> {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  appearance?: 'os' | 'site';
}

function optionsOf(children: ReactNode, group?: string, disabled = false): SelectOption<string>[] {
  const options: SelectOption<string>[] = [];
  Children.forEach(children, child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; label?: string; disabled?: boolean; style?: CSSProperties }>(child)) return;
    const props = child.props;
    if (child.type === Fragment || child.type === 'optgroup') {
      options.push(...optionsOf(props.children, props.label ?? group, disabled || !!props.disabled));
    } else if (child.type === 'option') {
      const label = props.label ?? Children.toArray(props.children).join('');
      options.push({ value: String(props.value ?? label), label, group, disabled: disabled || props.disabled, style: props.style });
    }
  });
  return options;
}

/** Native option markup, backed by the same menu and keyboard logic as every dropdown. */
export function Select({ children, value, defaultValue, onChange, appearance = 'os', className, ...triggerProps }: SelectProps) {
  const options = optionsOf(children);
  const [uncontrolled, setUncontrolled] = useState(() => String(defaultValue ?? options.find(o => !o.disabled)?.value ?? ''));
  return <Dropdown appearance={appearance} className={className} triggerProps={triggerProps}
    value={String(value ?? uncontrolled)} options={options} onChange={next => { setUncontrolled(next); onChange?.(next); }} />;
}
