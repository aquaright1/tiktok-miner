"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

const formSchema = z.object({
  inputType: z.enum(["username", "profile_link"]).default("username"),
  username: z.string().optional(),
  profileLink: z.string().optional(),
  platform: z.enum(["tiktok", "instagram", "youtube", "twitter"]),
  followerCount: z.string().transform((val) => parseInt(val) || 0),
  videoCount: z.string().transform((val) => parseInt(val) || 0),
  totalHearts: z.string().transform((val) => parseInt(val) || 0),
  avgLikesPerPost: z.string().transform((val) => parseInt(val) || 0),
  tags: z.string().transform((val) => 
    val.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
  ),
  runPipeline: z.boolean().default(false)
}).refine((data) => {
  if (data.inputType === "username") {
    return data.username && data.username.length > 0;
  } else {
    return data.profileLink && data.profileLink.length > 0;
  }
}, {
  message: "Username or profile link is required",
  path: ["username"]
})

export function AddCreatorDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inputType: "username",
      username: "",
      profileLink: "",
      platform: "tiktok",
      followerCount: "0",
      videoCount: "0",
      totalHearts: "0",
      avgLikesPerPost: "0",
      tags: "",
      runPipeline: false
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    
    try {
      // Extract username from profile link if provided
      let username = values.username || '';
      
      if (values.inputType === 'profile_link' && values.profileLink) {
        // Extract username from TikTok URL
        const match = values.profileLink.match(/tiktok\.com\/@?([^/?]+)/);
        if (match) {
          username = match[1].replace('@', '');
        } else {
          throw new Error('Invalid TikTok profile link');
        }
      }
      
      // If pipeline is requested, run it
      if (values.runPipeline && values.platform === 'tiktok') {
        const pipelineResponse = await fetch('/api/pipeline/tiktok-30d', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profiles: [username],
            category: values.tags.join(', ')
          }),
        });
        
        if (!pipelineResponse.ok) {
          throw new Error('Failed to start pipeline');
        }
        
        const pipelineData = await pipelineResponse.json();
        toast.success(`Started scraping @${username}. This may take a few minutes.`);
        
        // Close dialog and refresh
        form.reset()
        setOpen(false)
        onSuccess()
        
        return;
      }
      
      // Otherwise, add creator manually
      const engagementRate = values.followerCount > 0 
        ? (values.avgLikesPerPost / values.followerCount) * 100 
        : 0
        
      const avgLikesPerVideo = values.videoCount > 0
        ? values.totalHearts / values.videoCount
        : 0
      
      const profileUrl = {
        tiktok: `https://www.tiktok.com/@${username}`,
        instagram: `https://www.instagram.com/${username}`,
        youtube: `https://www.youtube.com/@${username}`,
        twitter: `https://twitter.com/${username}`
      }[values.platform]
      
      const response = await fetch('/api/creators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          platform: values.platform,
          followerCount: values.followerCount,
          videoCount: values.videoCount,
          totalHearts: values.totalHearts,
          avgLikesPerPost: values.avgLikesPerPost,
          avgLikesPerVideo,
          engagementRate,
          profileUrl,
          tags: values.tags
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to add creator')
      }
      
      toast.success(`Added @${username}`)
      form.reset()
      setOpen(false)
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add creator')
      console.error('Add error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Creator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Creator</DialogTitle>
          <DialogDescription>
            Add a new social media creator to the dashboard.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="inputType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Input Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="username" id="username" />
                        <Label htmlFor="username">Username</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="profile_link" id="profile_link" />
                        <Label htmlFor="profile_link">Profile Link</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {form.watch("inputType") === "username" ? (
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="username" {...field} />
                    </FormControl>
                    <FormDescription>
                      Without @ symbol
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="profileLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Link</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://www.tiktok.com/@username" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Full TikTok profile URL
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {form.watch("platform") === "tiktok" && (
              <FormField
                control={form.control}
                name="runPipeline"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Run Scraper Pipeline</FormLabel>
                      <FormDescription>
                        Automatically fetch profile data (30-day metrics)
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            
            {!form.watch("runPipeline") && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="followerCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Followers</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="videoCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Videos/Posts</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="totalHearts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Hearts/Likes</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="avgLikesPerPost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avg Likes/Post</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}
            
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input placeholder="tag1, tag2, tag3" {...field} />
                  </FormControl>
                  <FormDescription>
                    Comma-separated list of tags
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  form.watch("runPipeline") ? 'Starting Pipeline...' : 'Adding...'
                ) : (
                  form.watch("runPipeline") ? 'Start Pipeline' : 'Add Creator'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}