import { Button } from "@/components/ui/button"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function ShadcnTestPage() {
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-8">Shadcn/UI Test Page</h1>
      
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Test Form</CardTitle>
          <CardDescription>
            This is a test form using shadcn/ui components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Name</label>
            <Input id="name" placeholder="Enter your name" />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input id="email" type="email" placeholder="Enter your email" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline">Cancel</Button>
          <Button>Submit</Button>
        </CardFooter>
      </Card>
    </div>
  )
} 