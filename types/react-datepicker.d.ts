declare module 'react-datepicker' {
  import { Component } from 'react';

  export interface ReactDatePickerProps {
    selected?: Date | null;
    onChange: (date: Date | null, event?: React.SyntheticEvent<any> | undefined) => void;
    placeholderText?: string;
    dateFormat?: string;
    showMonthDropdown?: boolean;
    showYearDropdown?: boolean;
    dropdownMode?: 'scroll' | 'select';
    className?: string;
    wrapperClassName?: string;
    withPortal?: boolean;
    [key: string]: any;
  }

  export default class DatePicker extends Component<ReactDatePickerProps> {}
}

declare module 'react-datepicker/dist/react-datepicker.css';
