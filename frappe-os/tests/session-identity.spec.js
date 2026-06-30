// Live session identity (issue 01): the menu-bar label + dashboard greeting are projected
// from the boot user's name, never demo data. These pin the pure projection — `firstName`
// (the token the greeting addresses) and `greeting` (which drops the name for a neutral
// salutation when none is known, rather than showing a placeholder).
import { describe, expect, it } from 'vitest'
import { firstName, greeting } from '../src/config/apps'

describe('firstName', () => {
  it('takes the leading token of a full name', () => {
    expect(firstName('Faris Ansari')).toBe('Faris')
    expect(firstName('Riya')).toBe('Riya')
  })

  it('is empty for a missing / blank name', () => {
    expect(firstName()).toBe('')
    expect(firstName(null)).toBe('')
    expect(firstName('   ')).toBe('')
  })
})

describe('greeting', () => {
  it('addresses the session user by first name', () => {
    expect(greeting('Faris Ansari')).toBe('Good afternoon, Faris')
  })

  it('falls back to a neutral salutation when no user is known', () => {
    expect(greeting()).toBe('Good afternoon')
    expect(greeting(null)).toBe('Good afternoon')
    expect(greeting('')).toBe('Good afternoon')
  })
})
