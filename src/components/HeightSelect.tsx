import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const HEIGHT_OPTIONS = [
  `4'8"`, `4'9"`, `4'10"`, `4'11"`,
  `5'0"`, `5'1"`, `5'2"`, `5'3"`, `5'4"`, `5'5"`, `5'6"`, `5'7"`, `5'8"`, `5'9"`, `5'10"`, `5'11"`,
  `6'0"`, `6'1"`, `6'2"`, `6'3"`, `6'4"`, `6'5"`, `6'6"`, `6'7"`, `6'8"`, `6'9"`, `6'10"`, `6'11"`,
  `7'0"`, `7'1"`, `7'2"`,
];

export function HeightSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value || '__empty__'} onValueChange={(next) => onChange(next === '__empty__' ? '' : next)}>
      <SelectTrigger>
        <SelectValue placeholder="Select height" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__empty__">Prefer not to say</SelectItem>
        {HEIGHT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
