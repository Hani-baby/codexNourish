'use client'

import { FunctionTestPanel } from '@/components/testing/FunctionTestPanel'
import { IntegrationTest } from '@/components/testing/IntegrationTest'
import { PageLayout } from '@/components/layout/PageLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function TestingPage() {
  return (
    <PageLayout
      title="Testing & Integration"
      description="Test Supabase function integrations and real-time communication"
    >
      <Tabs defaultValue="integration" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="integration">Integration Tests</TabsTrigger>
          <TabsTrigger value="functions">Function Tests</TabsTrigger>
        </TabsList>
        <TabsContent value="integration" className="space-y-6">
          <IntegrationTest />
        </TabsContent>
        <TabsContent value="functions" className="space-y-6">
          <FunctionTestPanel />
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
