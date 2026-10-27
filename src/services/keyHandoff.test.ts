import { describe, it, expect } from 'vitest';
import { parseKeyHandoff } from './keyHandoff';

describe('parseKeyHandoff', () => {
  it('#nuvio-key=abc → token abc', () => {
    expect(parseKeyHandoff('#nuvio-key=abc')).toEqual({ token: 'abc' });
  });

  it('a urlencoded token is decoded', () => {
    const token = 'abc.def+ghi';
    expect(parseKeyHandoff('#nuvio-key=' + encodeURIComponent(token))).toEqual({ token });
  });

  it('extra params are ignored', () => {
    expect(parseKeyHandoff('#nuvio-key=abc&other=1&x=2')).toEqual({ token: 'abc' });
  });

  it('#other=1 → null', () => {
    expect(parseKeyHandoff('#other=1')).toBeNull();
  });

  it('empty hash → null', () => {
    expect(parseKeyHandoff('')).toBeNull();
  });

  it('#nuvio-key= (empty value) → null', () => {
    expect(parseKeyHandoff('#nuvio-key=')).toBeNull();
  });
});
