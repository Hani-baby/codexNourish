# Stripe Integration Setup Guide

## Overview
This document outlines the steps required to integrate Stripe payment processing for the Nourish subscription system.

## Subscription Plans

### Free Tier
- **Price**: $0/month
- **Features**:
  - 1 household member
  - AI meal plan once every 60 days
  - Maximum 7-day meal plans
  - Access to 21 recipes
  - No grocery lists
  - No Instacart integration
  - No AI Chef
  - No community access

### Individual Pro
- **Price**: $9.99/month
- **Features**:
  - 1 household member
  - Unlimited AI meal plans
  - Up to 365-day meal plans
  - Unlimited recipe access
  - Grocery lists enabled
  - Instacart integration
  - AI Chef access
  - Community access

### Family Plan
- **Price**: $19.99/month
- **Features**:
  - Up to 6 household members
  - All Individual Pro features shared across household
  - Family meal planning
  - Shared grocery lists

## Setup Steps

### 1. Create Stripe Account
1. Sign up at https://stripe.com
2. Complete business verification
3. Get API keys (test and live)

### 2. Create Products in Stripe Dashboard
Create two products with recurring pricing:

#### Individual Pro Product
- **Name**: Nourish Individual Pro
- **Description**: Personal nutrition optimization with unlimited features
- **Price**: $9.99 USD/month
- **Billing Period**: Monthly
- **Metadata**:
  - `tier`: `individual`
  - `max_members`: `1`

#### Family Plan Product
- **Name**: Nourish Family Plan
- **Description**: Perfect for families and households with up to 6 members
- **Price**: $19.99 USD/month
- **Billing Period**: Monthly
- **Metadata**:
  - `tier`: `family`
  - `max_members`: `6`

### 3. Configure Stripe Keys in Supabase

#### Environment Variables
Add to Supabase Edge Function secrets:
```bash
# Test keys (for development)
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
STRIPE_WEBHOOK_SECRET_TEST=whsec_test_...

# Live keys (for production)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Product/Price IDs
STRIPE_INDIVIDUAL_PRICE_ID=price_...
STRIPE_FAMILY_PRICE_ID=price_...
```

#### Add to .env.local (Frontend)
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 4. Create Stripe Edge Functions

#### Create `stripe-checkout` Function
```bash
cd supabase/functions
mkdir stripe-checkout
```

**File**: `supabase/functions/stripe-checkout/index.ts`
```typescript
import Stripe from 'https://esm.sh/stripe@13.0.0'
import { createServiceRoleClient } from '../_shared/database.ts'
import { getUserFromRequest } from '../_shared/auth.ts'
import { handleCors, createJsonResponse, createErrorResponse } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16'
})

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const user = await getUserFromRequest(req)
    if (!user) return createErrorResponse('Unauthorized', 401)

    const { household_id, plan_tier, success_url, cancel_url } = await req.json()

    // Get price ID based on tier
    const priceId = plan_tier === 'family' 
      ? Deno.env.get('STRIPE_FAMILY_PRICE_ID')
      : Deno.env.get('STRIPE_INDIVIDUAL_PRICE_ID')

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url,
      cancel_url,
      metadata: {
        household_id,
        user_id: user.id,
        plan_tier
      },
      customer_email: user.email
    })

    return createJsonResponse({
      success: true,
      checkout_url: session.url
    })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return createErrorResponse(error.message, 500)
  }
})
```

#### Create `stripe-webhook` Function
```bash
mkdir stripe-webhook
```

**File**: `supabase/functions/stripe-webhook/index.ts`
```typescript
import Stripe from 'https://esm.sh/stripe@13.0.0'
import { createServiceRoleClient } from '../_shared/database.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16'
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    const supabase = createServiceRoleClient()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const { household_id, plan_tier } = session.metadata

        // Update household subscription
        await supabase
          .from('household_subscriptions')
          .update({
            status: 'active',
            meta: {
              tier: plan_tier,
              stripe_subscription_id: session.subscription,
              stripe_customer_id: session.customer
            }
          })
          .eq('household_id', household_id)

        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = subscription.customer

        // Find household by stripe customer ID
        const { data: householdSub } = await supabase
          .from('household_subscriptions')
          .select('household_id')
          .eq('meta->>stripe_customer_id', customerId)
          .single()

        if (householdSub) {
          await supabase
            .from('household_subscriptions')
            .update({
              status: subscription.status === 'active' ? 'active' : 'inactive',
              meta: {
                ...householdSub.meta,
                stripe_status: subscription.status
              }
            })
            .eq('household_id', householdSub.household_id)
        }

        break
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(error.message, { status: 400 })
  }
})
```

#### Create `stripe-portal` Function
```bash
mkdir stripe-portal
```

**File**: `supabase/functions/stripe-portal/index.ts`
```typescript
import Stripe from 'https://esm.sh/stripe@13.0.0'
import { createServiceRoleClient } from '../_shared/database.ts'
import { getUserFromRequest } from '../_shared/auth.ts'
import { handleCors, createJsonResponse, createErrorResponse } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16'
})

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const user = await getUserFromRequest(req)
    if (!user) return createErrorResponse('Unauthorized', 401)

    const { household_id, return_url } = await req.json()

    const supabase = createServiceRoleClient()

    // Get stripe customer ID
    const { data: subscription } = await supabase
      .from('household_subscriptions')
      .select('meta')
      .eq('household_id', household_id)
      .single()

    const customerId = subscription?.meta?.stripe_customer_id

    if (!customerId) {
      return createErrorResponse('No active subscription found', 404)
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url
    })

    return createJsonResponse({
      success: true,
      portal_url: session.url
    })
  } catch (error) {
    console.error('Stripe portal error:', error)
    return createErrorResponse(error.message, 500)
  }
})
```

### 5. Configure Webhook Endpoint in Stripe

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://[your-project-ref].supabase.co/functions/v1/stripe-webhook`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret and add to Supabase secrets

### 6. Deploy Edge Functions

```bash
# Deploy all Stripe functions
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy stripe-portal
```

### 7. Testing

#### Test Mode Checklist
- [ ] Create test checkout session
- [ ] Complete test payment with card `4242 4242 4242 4242`
- [ ] Verify household_subscriptions updated
- [ ] Test subscription cancellation
- [ ] Test subscription reactivation
- [ ] Verify webhook events received

#### Production Checklist
- [ ] Switch to live API keys
- [ ] Update webhook endpoint to production
- [ ] Test with real card
- [ ] Monitor Stripe Dashboard for issues
- [ ] Set up email notifications for failed payments

### 8. Security Considerations

1. **Never expose secret keys** - Only use in Edge Functions
2. **Validate webhook signatures** - Always verify Stripe webhooks
3. **Use HTTPS only** - Required for Stripe
4. **Log all subscription changes** - For audit trail
5. **Handle failed payments** - Grace period before downgrade

### 9. Downgrade/Cancellation Flow

When subscription ends:
1. Webhook receives `customer.subscription.deleted`
2. Update household_subscriptions status to 'inactive'
3. Update meta to include tier: 'free'
4. Keep household data intact
5. Enforce free tier limits immediately
6. Send email notification to user

## Support Resources

- [Stripe Node.js Library](https://github.com/stripe/stripe-node)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

## Troubleshooting

### Webhook not receiving events
- Check webhook URL is correct
- Verify webhook secret matches
- Check Stripe Dashboard for delivery attempts
- Ensure Edge Function is deployed

### Checkout session fails
- Verify price IDs are correct
- Check API key permissions
- Ensure success/cancel URLs are valid
- Check browser console for errors

### Subscription not updating
- Check webhook signature validation
- Verify database permissions
- Check Edge Function logs
- Ensure metadata includes household_id

