import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing the component
vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  }
})

import { supabase } from '../lib/supabase'
import { VendorPageHeader } from '../VendorApp'

function makeMockChain({ data }) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    order: vi.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.limit.mockResolvedValue({ data })
  chain.order.mockResolvedValue({ data })
  return chain
}

describe('VendorPageHeader – singleBuName mode (RFQ page)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT show hardcoded "PH1 World Developers" when a specific BU is provided', async () => {
    const chain = makeMockChain({ data: [{ id: 2, name: 'South Superblock', logo_url: null }] })
    supabase.from.mockReturnValue(chain)

    render(
      <VendorPageHeader
        title="Request for Quotation"
        subtitle="RFQ-2026-0005"
        singleBuName="South Superblock"
      />
    )

    // Wait for async fetch to settle
    await waitFor(() => {
      expect(screen.queryByText(/PH1 World Developers/i)).not.toBeInTheDocument()
    })
  })

  it('shows the specific BU name as the primary identity', async () => {
    const chain = makeMockChain({ data: [{ id: 2, name: 'South Superblock', logo_url: null }] })
    supabase.from.mockReturnValue(chain)

    render(
      <VendorPageHeader
        title="Request for Quotation"
        subtitle="RFQ-2026-0005"
        singleBuName="South Superblock"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('South Superblock')).toBeInTheDocument()
    })
  })
})
