import assert from 'node:assert'
import { describe, it } from 'node:test'
import {
  activityMinutes,
  formatDuration,
  isValidTime,
  toMinutes,
} from '../src/libs/hours-time.ts'

describe('isValidTime', () => {
  it('accepts 24-hour times', () => {
    assert.strictEqual(isValidTime('00:00'), true)
    assert.strictEqual(isValidTime('09:15'), true)
    assert.strictEqual(isValidTime('9:15'), true)
    assert.strictEqual(isValidTime('23:59'), true)
  })

  it('rejects anything that is not a 24-hour time', () => {
    const invalid = [
      '',
      ' ',
      '24:00',
      '12:60',
      '12:5',
      '0930',
      '12:00:00',
      'ab:cd',
      '12:00 ',
      ' 12:00',
    ]
    for (const time of invalid) {
      assert.strictEqual(
        isValidTime(time),
        false,
        `expected ${time} to be invalid`,
      )
    }
  })
})

describe('toMinutes', () => {
  it('converts a time to minutes since midnight', () => {
    assert.strictEqual(toMinutes('00:00'), 0)
    assert.strictEqual(toMinutes('00:30'), 30)
    assert.strictEqual(toMinutes('09:15'), 555)
    assert.strictEqual(toMinutes('23:59'), 1439)
  })

  it('returns null for an invalid time', () => {
    assert.strictEqual(toMinutes(''), null)
    assert.strictEqual(toMinutes('24:00'), null)
    assert.strictEqual(toMinutes('12:60'), null)
  })
})

describe('activityMinutes', () => {
  it('measures the gap between the two times', () => {
    assert.strictEqual(activityMinutes({ from: '09:00', to: '10:30' }), 90)
    assert.strictEqual(activityMinutes({ from: '23:00', to: '23:59' }), 59)
  })

  it('returns zero for equal endpoints', () => {
    assert.strictEqual(activityMinutes({ from: '09:00', to: '09:00' }), 0)
    assert.strictEqual(activityMinutes({ from: '00:00', to: '00:00' }), 0)
    assert.strictEqual(activityMinutes({ from: '23:59', to: '23:59' }), 0)
  })

  it('uses the absolute difference when the end is earlier than the start', () => {
    assert.strictEqual(activityMinutes({ from: '10:00', to: '09:00' }), 60)
    assert.strictEqual(activityMinutes({ from: '23:59', to: '00:00' }), 1439)
  })

  it('returns null when either time is invalid', () => {
    assert.strictEqual(activityMinutes({ from: '', to: '10:00' }), null)
    assert.strictEqual(activityMinutes({ from: '10:00', to: '' }), null)
    assert.strictEqual(activityMinutes({ from: '24:00', to: '10:00' }), null)
    assert.strictEqual(activityMinutes({ from: '10:00', to: '12:60' }), null)
  })
})

describe('formatDuration', () => {
  it('formats minutes below an hour', () => {
    assert.strictEqual(formatDuration(0), '0 min')
    assert.strictEqual(formatDuration(1), '1 min')
    assert.strictEqual(formatDuration(45), '45 min')
    assert.strictEqual(formatDuration(59), '59 min')
  })

  it('formats whole hours', () => {
    assert.strictEqual(formatDuration(60), '1 h')
    assert.strictEqual(formatDuration(120), '2 h')
    assert.strictEqual(formatDuration(180), '3 h')
  })

  it('formats hours with leftover minutes', () => {
    assert.strictEqual(formatDuration(90), '1 h 30 min')
    assert.strictEqual(formatDuration(1439), '23 h 59 min')
  })
})
